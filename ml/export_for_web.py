"""
Turns the notebook's export (export/item_vectors.npz + export/items.csv) into three small files the website reads directly:

    data/smartpicks/vectors.f32   all movie vectors, 32-bit floats, row after row
    data/smartpicks/items.json    [[tmdbId, title, year, numberOfRatings], ...] in the same order
    data/smartpicks/meta.json     what the model is, and how well it did (shown on the site's /model page)

Run:  python export_for_web.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "data" / "smartpicks"
OUT.mkdir(parents=True, exist_ok=True)

z = np.load(HERE / "export" / "item_vectors.npz")
items = pd.read_csv(HERE / "export" / "items.csv")
res = json.loads((HERE / "export" / "results.json").read_text())
vecs = z["vectors"].astype("<f4")
tmdb = z["tmdb_id"].astype(int)
assert len(items) == len(vecs) == len(tmdb), "items and vectors are out of step"
assert (items.tmdbId.to_numpy() == tmdb).all(), "ordering mismatch between items.csv and the vectors"

# one entry per TMDB id (a handful of movies share an id in MovieLens: keep the most-rated)
order = np.argsort(-items.n_ratings.to_numpy(), kind="stable")
seen, keep = set(), []
for i in order:
    if tmdb[i] not in seen:
        seen.add(tmdb[i]); keep.append(i)
keep = sorted(keep)
print(f"{len(items)} movies -> {len(keep)} unique TMDB ids")

vecs = vecs[keep]
items = items.iloc[keep].reset_index(drop=True)
(OUT / "vectors.f32").write_bytes(vecs.tobytes())
rows = [[int(t), str(ti), (int(y) if pd.notna(y) else 0), int(n)] for t, ti, y, n in zip(items.tmdbId, items.title, items.year, items.n_ratings)]
(OUT / "items.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf8")

test = res["test"]
meta = {
    "count": len(rows), "dim": int(vecs.shape[1]), "dataset": res["dataset"], "users": res["users"], "ratings": res["ratings"],
    "latest_movie_year": int(items.year.max()),
    "model": res["model"], "hand_over_n0": 40,
    "test": {"hit@10": test["Smart picks (PureSVD)"]["hit@10"], "ci95": test["Smart picks (PureSVD)"]["ci95"], "popularity_hit@10": test["Popularity"]["hit@10"],
             "lift": res["lift_vs_popularity"], "lift_interval_diff": res["lift_interval_diff"]},
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2))
for f in ("vectors.f32", "items.json", "meta.json"):
    print(f"  {f:14s} {(OUT / f).stat().st_size / 1024:8.0f} KB")
