"""
Does the website's TypeScript give the same recommendations as the Python the notebook was built on?
Recomputes the ranking in numpy and compares it with the live /api/smartpicks answer.
Run (with the site on localhost:3000):   python parity_check.py
"""
import json, sys, urllib.request
from pathlib import Path
import numpy as np

D = Path(__file__).resolve().parent.parent / "data" / "smartpicks"
meta = json.loads((D / "meta.json").read_text())
rows = json.loads((D / "items.json").read_text(encoding="utf8"))
V = np.frombuffer((D / "vectors.f32").read_bytes(), dtype="<f4").reshape(len(rows), meta["dim"]).astype(np.float64)
tmdb = np.array([r[0] for r in rows]); logpop = np.log1p(np.array([r[3] for r in rows], dtype=float))
index = {t: i for i, t in enumerate(tmdb)}
norm = np.linalg.norm(V, axis=1)

def z(x): return (x - x.mean()) / (x.std() + 1e-9)

def reference(liked, seen, beta, limit):
    hist = [index[t] for t in dict.fromkeys(liked) if t in index]
    taste = V[hist].sum(0)
    raw = V @ taste
    if beta > 0: raw = raw / (norm + 1e-9) ** beta
    w = min(1.0, len(hist) / meta["hand_over_n0"])
    final = w * z(raw) + (1 - w) * z(logpop)
    ex = set(hist) | {index[t] for t in seen if t in index}
    order = [i for i in np.argsort(-final) if i not in ex][:limit]
    return [int(tmdb[i]) for i in order]

def live(liked, seen, beta, limit):
    q = f"liked={','.join(map(str, liked))}&seen={','.join(map(str, seen))}&beta={beta}&limit={limit}"
    with urllib.request.urlopen("http://localhost:3000/api/smartpicks?" + q, timeout=90) as r:
        return [x["externalId"] for x in json.loads(r.read())["results"]]

by_pop = np.argsort(-np.array([r[3] for r in rows]))
cases = {
    "5 movies, beta 0.5": ([603, 550, 680, 13, 238], [603], 0.5),
    "12 movies, beta 0": ([int(tmdb[i]) for i in by_pop[:12]], [], 0.0),
    "45 movies, beta 0.75": ([int(tmdb[i]) for i in by_pop[10:55]], [int(tmdb[by_pop[3]])], 0.75),
    "1 movie, beta 0.25": ([862], [], 0.25),
    "unknown ids are ignored": ([603, 999999999, 550], [123456789], 0.5),
}
bad = 0
for name, (liked, seen, beta) in cases.items():
    ref, got = reference(liked, seen, beta, 15), live(liked, seen, beta, 15)
    same_set, same_order = set(ref) == set(got), ref == got
    overlap = len(set(ref) & set(got))
    print(f"{'PASS' if same_order else ('~ ' if same_set else 'FAIL')}  {name:26s} identical order: {same_order}  same 15 movies: {same_set}  overlap {overlap}/15")
    bad += 0 if same_set else 1
print("\nRESULT:", "website and notebook agree" if bad == 0 else f"{bad} case(s) differ")
sys.exit(bad)
