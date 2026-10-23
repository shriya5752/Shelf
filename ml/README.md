# Smart picks: the machine-learning part of Shelf

A small recommender, trained on real ratings, that suggests movies a person is likely to like.
It is built to be honest about how good it is: every claim below comes from a held-out test and a confidence interval.

## The idea in four lines
1. From who liked what, learn a vector of 128 numbers for every movie. Movies liked by the same kinds of people get similar vectors.
2. A person's **taste** is the sum of the vectors of the movies they liked ("fold-in"). No model is trained per person.
3. Recommend the movies that line up best with that taste vector.
4. On the website this is one database query, so **no model server is needed at run time**.

## Result (held-out test, 603 people, ranking all ~9,700 movies each)
| Model | hit@10 | 95% interval | median rank |
|---|---|---|---|
| Popularity (same hits for everyone) | 4.1% | ±1.6 | 502 |
| Genres only | 0.2% | ±0.3 | 2837 |
| BPR (neural, PyTorch) | 6.6% | ±2.0 | 365 |
| **Smart picks (PureSVD)** | **8.6%** | ±2.2 | **225** |

Smart picks finds the person's hidden liked movie **2.1x as often as popularity**; the paired bootstrap interval for the improvement is
+2.3 to +6.8 percentage points, so it is not luck. Full numbers: `export/results.json`.

## What the experiments found (not just the good news)
* A plain matrix factorisation (PureSVD) beat a neural model (BPR) on this small dataset.
* The model needs roughly **10-20+ ratings per person** to beat popularity; with 1-5 ratings it does not. A popularity fallback that fades out as history grows fixes the dip.
* Recommending by raw score drifts to blockbusters (70% of picks were from the 100 most-rated movies). A single `beta` knob gives more varied picks at no measurable accuracy cost up to about 0.5.
* Blending in genres did not help for movies that already have many ratings.
* Limits: movies only (no TV series), nothing after 2018, 610 people.

## Files
| File | What it is |
|---|---|
| `notebooks/01_smart_picks.ipynb` | The whole story with explanations, charts and results. **Start here.** |
| `smartpicks.py` | Data loading, leak-free split, models, evaluation (reused by the notebook and later the export script) |
| `build_notebook.py` | Regenerates the notebook from source |
| `export/item_vectors.npz`, `export/items.csv` | The movie vectors and their TMDB ids, ready to load into the database |
| `export/results.json`, `export/figures/` | Metrics and charts |
| `data/` | The MovieLens files (not part of the project; download below) |

## Reproduce it
```bash
# 1. data (about 1 MB): https://files.grouplens.org/datasets/movielens/ml-latest-small.zip  -> unzip into ml/data/
# 2. libraries (see requirements.txt), then:
python -m jupyter notebook notebooks/01_smart_picks.ipynb          # explore it
python -m jupyter nbconvert --to notebook --execute --inplace notebooks/01_smart_picks.ipynb   # or just re-run everything (about 1 minute)
```
Tested with Python 3.10.11. Everything is seeded, so numbers repeat.

## Credit
MovieLens data: F. Maxwell Harper and Joseph A. Konstan. *The MovieLens Datasets: History and Context.* ACM Transactions on Interactive Intelligent Systems 5(4), 2015.
Provided by GroupLens (University of Minnesota) for non-commercial research and education. If Shelf ever becomes a commercial product, get permission from GroupLens or train on other data.
