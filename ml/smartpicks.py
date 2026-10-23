"""
Smart picks: a small recommender for Shelf, trained on MovieLens.

The idea (and why it is built this way)
---------------------------------------
Every movie gets a short vector ("embedding") learned from what many people rated.
Movies people tend to like together end up close together.  A *new* person on Shelf has
no model of their own: we take the vectors of the titles they have rated and combine them
into one "taste vector" (this is called *fold-in*).  Recommending is then just: which movies
are closest to that taste vector?  That needs only the movie vectors, so at run time the
website can answer with one database query and no model server.

Everything the notebook needs lives here so it can also be reused by the export script:
data loading, a leak-free train/test split, the models, and the evaluation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

DATA_DIR = Path(__file__).resolve().parent / "data" / "ml-latest-small"
POSITIVE = 4.0  # a rating of 4 stars or more counts as "liked"


# ----------------------------------------------------------------------------- data
def fix_article(title: str) -> str:
    """MovieLens writes 'Matrix, The'. Turn it back into 'The Matrix'."""
    m = re.match(r"^(.*), (The|A|An)$", title.strip())
    return f"{m.group(2)} {m.group(1)}" if m else title.strip()


def norm_title(title: str) -> str:
    """Lower-case letters and digits only, so 'Spider-Man' and 'Spider Man' match."""
    t = title.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "", t)


@dataclass
class Data:
    ratings: pd.DataFrame      # userIdx, itemIdx, rating, timestamp, pos (order within the user's history)
    movies: pd.DataFrame       # one row per item, indexed by itemIdx
    n_users: int
    n_items: int
    genre_names: list[str]
    genre_matrix: np.ndarray   # items x genres, multi-hot


def load_data() -> Data:
    ratings = pd.read_csv(DATA_DIR / "ratings.csv")
    movies = pd.read_csv(DATA_DIR / "movies.csv")
    links = pd.read_csv(DATA_DIR / "links.csv")

    # keep only movies somebody rated, and give users/movies compact 0..n-1 indices
    movies = movies[movies.movieId.isin(ratings.movieId.unique())].merge(links[["movieId", "tmdbId"]], on="movieId", how="left")
    movies = movies.sort_values("movieId").reset_index(drop=True)
    movies.index.name = "itemIdx"
    movies["year"] = pd.to_numeric(movies.title.str.extract(r"\((\d{4})\)\s*$")[0], errors="coerce")
    movies["clean_title"] = movies.title.str.replace(r"\s*\(\d{4}\)\s*$", "", regex=True).map(fix_article)
    movies["key"] = movies.clean_title.map(norm_title)
    item_of = {mid: i for i, mid in enumerate(movies.movieId)}
    user_ids = np.sort(ratings.userId.unique())
    user_of = {uid: i for i, uid in enumerate(user_ids)}

    r = ratings.assign(userIdx=ratings.userId.map(user_of), itemIdx=ratings.movieId.map(item_of))
    r = r[["userIdx", "itemIdx", "rating", "timestamp"]].sort_values(["userIdx", "timestamp"], kind="stable").reset_index(drop=True)
    r["pos"] = r.groupby("userIdx").cumcount()   # position in the user's own history (ties in timestamp keep file order)

    genres = sorted({g for gs in movies.genres for g in gs.split("|") if g != "(no genres listed)"})
    gm = np.zeros((len(movies), len(genres)), dtype=np.float32)
    gi = {g: j for j, g in enumerate(genres)}
    for i, gs in enumerate(movies.genres):
        for g in gs.split("|"):
            if g in gi:
                gm[i, gi[g]] = 1.0
    return Data(r, movies, len(user_ids), len(movies), genres, gm)


# ----------------------------------------------------------------------------- split
@dataclass
class Split:
    train: pd.DataFrame                 # everything a user did BEFORE the held-out title
    targets: dict[int, int]             # user -> the held-out liked title we try to predict
    hist: dict[int, tuple[np.ndarray, np.ndarray]]  # user -> (items, ratings) in chronological order


def make_split(d: Data, stage: str = "test", min_pos: int = 5) -> Split:
    """
    Leave-one-out *in time*: for each user, hide their last liked title (stage='test') or the one
    before it (stage='val') and keep only what they rated earlier as history.  Nothing from the
    "future" leaks into the history, which is the usual way a recommender is fooled into looking good.
    """
    r = d.ratings
    pos = r[r.rating >= POSITIVE]
    users = pos.groupby("userIdx").size()
    users = users[users >= min_pos].index
    k = 1 if stage == "test" else 2
    tgt = pos[pos.userIdx.isin(users)].groupby("userIdx").tail(k).groupby("userIdx").head(1)
    tpos = dict(zip(tgt.userIdx, tgt.pos))
    targets = dict(zip(tgt.userIdx, tgt.itemIdx))
    mask = r.userIdx.isin(targets) & (r.pos < r.userIdx.map(tpos))
    train = r[mask].reset_index(drop=True)
    hist = {u: (g.itemIdx.to_numpy(), g.rating.to_numpy(dtype=np.float32)) for u, g in train.groupby("userIdx")}
    return Split(train, {u: t for u, t in targets.items() if u in hist}, hist)


# ----------------------------------------------------------------------------- models
class Popularity:
    """Baseline 1: recommend what most people liked, to everybody."""
    name = "Popularity"

    def __init__(self, train: pd.DataFrame, n_items: int):
        self.pop = np.bincount(train[train.rating >= POSITIVE].itemIdx, minlength=n_items).astype(np.float64)

    def scores(self, items, ratings):
        return self.pop.copy()


class ItemVectors:
    """
    A model that is nothing but one vector per movie.  A person's taste is built from the movies
    they rated ("fold-in"), so no per-user training is ever needed.  Then every movie is scored by

        score(m) = v_m . u        where u = the person's taste vector

    Ways to build u from their history:
        'likes'   : add up the vectors of the titles they liked (4 stars or more)      <- used by Shelf
        'ones'    : add up the vectors of everything they watched, rated or not
        'mean'    : add up (rating - their average) * vector  (so low ratings push away)
        'ridge'   : least-squares fit of the ratings in the latent space (lam = strength of the penalty)
    """
    def __init__(self, V: np.ndarray, name: str, fold: str = "likes", lam: float = 1.0):
        self.V, self.name, self.fold, self.lam = V.astype(np.float64), name, fold, lam

    def taste(self, items, ratings) -> np.ndarray:
        items = np.asarray(items, dtype=int)
        r = np.asarray(ratings, dtype=np.float64)
        if self.fold == "likes":
            keep = r >= POSITIVE
            if not keep.any():           # nothing rated 4+ (e.g. only "watched"): fall back to everything
                keep = np.ones_like(keep)
            return self.V[items[keep]].sum(0)
        if self.fold == "ones":
            return self.V[items].sum(0)
        r = r - r.mean() if len(r) > 1 else r
        if np.allclose(r, 0):
            r = np.ones_like(r)
        Vh = self.V[items]
        if self.fold == "ridge":
            return np.linalg.solve(Vh.T @ Vh + self.lam * np.eye(Vh.shape[1]), Vh.T @ r)
        return Vh.T @ r

    def scores(self, items, ratings):
        if len(items) == 0:
            return np.zeros(self.V.shape[0])
        return self.V @ self.taste(items, ratings)


def genre_vectors(d: Data) -> np.ndarray:
    """Genre multi-hot weighted so rare genres count more (inverse document frequency), then unit length."""
    df = d.genre_matrix.sum(0) + 1
    idf = np.log(len(d.genre_matrix) / df) + 1
    return normalize(d.genre_matrix * idf)


def fit_svd(train: pd.DataFrame, d: Data, k: int = 32, seed: int = 0) -> np.ndarray:
    """Classic matrix factorisation: SVD of the (user x movie) matrix of centred ratings."""
    mu = train.groupby("userIdx").rating.transform("mean")
    X = sp.csr_matrix(((train.rating - mu).to_numpy(), (train.userIdx, train.itemIdx)), shape=(d.n_users, d.n_items))
    svd = TruncatedSVD(n_components=k, random_state=seed).fit(X)
    return svd.components_.T.copy()        # items x k


def fit_puresvd(train: pd.DataFrame, d: Data, k: int = 64, gamma: float = 0.5, positives_only: bool = True, seed: int = 0) -> np.ndarray:
    """
    PureSVD (Cremonesi et al.): factorise the plain 0/1 matrix "this person liked this movie".
    Each movie ends up with a k-number vector; gamma scales the vectors by singular_value ** gamma
    (0 = every direction counts the same, 1 = the biggest directions dominate).
    """
    t = train[train.rating >= POSITIVE] if positives_only else train
    X = sp.csr_matrix((np.ones(len(t)), (t.userIdx, t.itemIdx)), shape=(d.n_users, d.n_items))
    svd = TruncatedSVD(n_components=k, random_state=seed).fit(X)
    return svd.components_.T * (svd.singular_values_ ** gamma)


def fit_bpr(train: pd.DataFrame, d: Data, dim: int = 32, epochs: int = 40, lr: float = 0.02, reg: float = 1e-4,
            batch: int = 4096, seed: int = 0, verbose: bool = False) -> tuple[np.ndarray, np.ndarray, list[float]]:
    """
    Bayesian Personalised Ranking (Rendle et al.), written in PyTorch.
    Learns user and movie vectors so that, for each user, a movie they liked scores higher than a random
    movie they did not rate:   loss = -log sigmoid( s(u, liked) - s(u, random) ).
    Returns (user vectors, movie vectors, loss per epoch).
    """
    import torch
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    pos = train[train.rating >= POSITIVE]
    U, I = pos.userIdx.to_numpy(), pos.itemIdx.to_numpy()
    seen = sp.csr_matrix((np.ones(len(train)), (train.userIdx, train.itemIdx)), shape=(d.n_users, d.n_items))
    pu = torch.nn.Embedding(d.n_users, dim)
    qi = torch.nn.Embedding(d.n_items, dim)
    torch.nn.init.normal_(pu.weight, std=0.1)
    torch.nn.init.normal_(qi.weight, std=0.1)
    opt = torch.optim.Adam(list(pu.parameters()) + list(qi.parameters()), lr=lr)
    losses: list[float] = []
    for ep in range(epochs):
        order = rng.permutation(len(U))
        total = 0.0
        for s in range(0, len(order), batch):
            b = order[s:s + batch]
            u, i = U[b], I[b]
            j = rng.integers(0, d.n_items, size=len(b))
            bad = np.asarray(seen[u, j]).ravel() > 0           # drew something the user did rate: draw again once
            j[bad] = rng.integers(0, d.n_items, size=bad.sum())
            u_, i_, j_ = torch.as_tensor(u), torch.as_tensor(i), torch.as_tensor(j)
            pe, qe, ne = pu(u_), qi(i_), qi(j_)
            x = (pe * qe).sum(1) - (pe * ne).sum(1)
            loss = -torch.nn.functional.logsigmoid(x).mean() + reg * (pe.pow(2).sum(1) + qe.pow(2).sum(1) + ne.pow(2).sum(1)).mean()
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += float(loss.detach()) * len(b)
        losses.append(total / len(order))
        if verbose and (ep % 10 == 0 or ep == epochs - 1):
            print(f"  epoch {ep + 1:>3}: loss {losses[-1]:.4f}")
    return pu.weight.detach().numpy(), qi.weight.detach().numpy(), losses


def hybrid(V_cf: np.ndarray, V_genre: np.ndarray, alpha: float) -> np.ndarray:
    """
    Join what people rated (collaborative) with what a movie is (genres).
    The collaborative part keeps its natural scale, because a vector's length carries "how widely liked
    this is"; the genre part is scaled to alpha x the typical collaborative length.
    """
    scale = np.median(np.linalg.norm(V_cf, axis=1))
    return np.hstack([V_cf, alpha * scale * normalize(V_genre)])


# ----------------------------------------------------------------------------- evaluation
def evaluate(model, split: Split, k: int = 10, max_hist: int | None = None) -> dict:
    """
    For each person: score EVERY movie they have not rated yet, and see where the held-out liked movie lands.
      hit@k   : was it in the top k?                    ndcg@k : like hit@k, but higher ranks count more
      mrr     : 1 / rank                                 pop    : how mainstream the top-k are (lower = more diverse)
    """
    hits, ndcgs, mrrs, ranks = [], [], [], []
    shown: list[int] = []
    for u, target in split.targets.items():
        items, ratings = split.hist[u]
        if max_hist is not None:
            items, ratings = items[:max_hist], ratings[:max_hist]
        s = np.asarray(model.scores(items, ratings), dtype=np.float64).copy()
        t = s[target]
        s[items] = -np.inf                                    # never recommend what they already rated
        s[target] = t
        better = (s > t).sum()
        ties = ((s == t).sum() - 1) / 2                       # fair tie-break
        rank = better + ties
        ranks.append(rank)
        hits.append(float(rank < k))
        ndcgs.append(1.0 / np.log2(rank + 2) if rank < k else 0.0)
        mrrs.append(1.0 / (rank + 1))
        shown.extend(np.argpartition(-s, k)[:k].tolist())
    hits = np.array(hits)
    n = len(hits)
    se = np.sqrt(hits.mean() * (1 - hits.mean()) / n)
    return {"hit@10": hits.mean(), "ci95": 1.96 * se, "ndcg@10": float(np.mean(ndcgs)), "mrr": float(np.mean(mrrs)),
            "median_rank": float(np.median(ranks)), "distinct_recs": len(set(shown)),
            "users": n, "per_user_hit": hits}


def top_n(model, items, ratings, n: int = 10, exclude=None) -> list[int]:
    s = np.asarray(model.scores(np.asarray(items), np.asarray(ratings, dtype=np.float32)), dtype=np.float64).copy()
    s[np.asarray(items, dtype=int)] = -np.inf
    if exclude is not None:
        s[np.asarray(list(exclude), dtype=int)] = -np.inf
    return np.argsort(-s)[:n].tolist()


def because(model: ItemVectors, items, ratings, candidate: int, n: int = 2) -> list[int]:
    """Which of the person's own titles pulled this suggestion in?  (Largest contribution to its score.)"""
    items = np.asarray(items, dtype=int)
    ratings = np.asarray(ratings, dtype=np.float64)
    use = items[ratings >= POSITIVE] if (ratings >= POSITIVE).any() else items
    contrib = model.V[use] @ model.V[candidate]
    return use[np.argsort(-contrib)[:n]].tolist()


def match_percent(scores: np.ndarray, picked: np.ndarray) -> np.ndarray:
    """
    A relative 0-100 'match' for the picked titles: where each one sits between the median movie (0)
    and the best-scoring movie in the whole catalogue (100).  It is NOT a probability.
    """
    lo, hi = np.median(scores), scores.max()
    return np.clip((scores[picked] - lo) / (hi - lo + 1e-12), 0, 1) * 100
