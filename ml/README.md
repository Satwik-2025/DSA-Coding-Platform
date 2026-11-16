# Retraining the retention model

The backend predicts how well a learner remembers each topic with half-life regression (HLR,
Settles & Meeder 2016). The shipped weights (`backend/src/main/resources/ml/hlr_weights.json`)
were trained on Codeforces data. `train_hlr.py` retrains the same model on this platform's own
learners, so predictions improve as people use it.

## Requirements

Python 3.9+ and numpy:

```bash
pip install -r ml/requirements.txt
```

## Steps

1. Start the backend and let learners submit solutions for a while.
2. Train on the platform's attempt history (exported by `GET /api/ml/training-data`):

   ```bash
   python ml/train_hlr.py --url http://localhost:8081/api/ml/training-data --out hlr_weights.new.json
   ```

   It splits rows **by learner** (20% held out), trains, and prints the held-out MAE and AUC of the
   new model, the shipped model and two baselines (fixed 7-day half-life, average recall).
3. Deploy only if it is better:

   ```bash
   python ml/train_hlr.py --url http://localhost:8081/api/ml/training-data --deploy
   ```

   `--deploy` overwrites the shipped weights only when the new model has an AUC at least as high and
   a lower-or-equal MAE than the shipped model on the same held-out learners, with at least
   `--min-test-rows` (default 200) held-out rows. Otherwise it exits without touching the file
   (`--force` overrides). Restart the backend afterwards; it validates the file at startup.

Other options: `--data file.csv` instead of `--url`, `--warm-start` to start from the shipped theta,
`--fixtures path.json` to write Java parity fixtures for the new weights (copy them to
`backend/src/test/resources/ml/hlr_fixtures.json` so `HlrFixtureParityTest` checks the new model).

## Self-check

```bash
python ml/train_hlr.py --simulate 400 --out /tmp/sim.json
```

Generates synthetic learners whose memory follows a known HLR model and trains on them. The new
model should clearly beat the baselines on held-out learners (AUC about 0.84 vs 0.82 for a fixed
7-day half-life).

## Training rows

One row per attempt that follows an earlier attempt by the same learner in the same topic:

| Column | Meaning |
|---|---|
| `delta_days` | days since the previous attempt in that topic |
| `correct_before`, `wrong_before`, `mean_difficulty_before` | the model's features just before this attempt |
| `recalled` | 1 if this attempt was accepted, else 0 |

Learners appear only by numeric id; no code or names are exported.
