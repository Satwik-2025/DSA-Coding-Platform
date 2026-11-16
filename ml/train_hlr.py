"""Retrain the half-life regression (HLR) retention model on the platform's own learners.

Pipeline
  1. Export training rows from the running backend:   GET /api/ml/training-data  (CSV)
  2. Train, evaluate on held-out learners, compare with the shipped model and two baselines.
  3. Write weights in the exact format Java loads (CONTRACT.md section 6). With --deploy the file
     replaces backend/src/main/resources/ml/hlr_weights.json, but only if the new model beats the
     shipped one on the same held-out learners (or --force is given).

Model (Settles & Meeder, 2016), identical to learner/HlrPredictor.java:
  x = [1, sqrt(1+correct), sqrt(1+wrong), mean_difficulty, one-hot(topic 1..10)]
  h = clamp(2^(theta . x), min_h, max_h)       half-life in days
  p = 2^(-delta_days / h)                       predicted recall
Loss per row: (p - p_hat)^2 + alpha * (log2 h_target - theta . x)^2, plus L2 on theta, where
h_target = -delta / log2(p) is the half-life that would explain the observed outcome.

Usage
  python ml/train_hlr.py --url http://localhost:8081/api/ml/training-data --out new_weights.json
  python ml/train_hlr.py --data hlr_training_data.csv --deploy
  python ml/train_hlr.py --simulate 400 --out /tmp/sim.json        (self-check on synthetic learners)
"""
import argparse
import csv
import io
import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timezone

import numpy as np

FEATURE_ORDER = [
    "bias", "sqrt_correct", "sqrt_wrong", "mean_difficulty",
    "topic_arrays", "topic_strings", "topic_two_pointers", "topic_sliding_window",
    "topic_hashmap", "topic_linkedlist", "topic_stack", "topic_trees",
    "topic_graphs", "topic_dp",
]
MIN_H, MAX_H = 0.25, 180.0
P_CLIP = (0.0001, 0.9999)
HERE = os.path.dirname(os.path.abspath(__file__))
SHIPPED = os.path.join(HERE, "..", "backend", "src", "main", "resources", "ml", "hlr_weights.json")


# ---------------------------------------------------------------- data

def features(correct, wrong, mean_difficulty, topic_id):
    x = np.zeros(len(FEATURE_ORDER))
    x[0] = 1.0
    x[1] = math.sqrt(1 + correct)
    x[2] = math.sqrt(1 + wrong)
    x[3] = mean_difficulty
    x[3 + int(topic_id)] = 1.0
    return x


def load_rows(text):
    rows = list(csv.DictReader(io.StringIO(text)))
    users = np.array([int(r["user_id"]) for r in rows], dtype=np.int64)
    X = np.array([features(int(r["correct_before"]), int(r["wrong_before"]),
                           float(r["mean_difficulty_before"]), int(r["topic_id"])) for r in rows]).reshape(-1, len(FEATURE_ORDER))
    delta = np.array([float(r["delta_days"]) for r in rows])
    p = np.array([float(r["recalled"]) for r in rows])
    return users, X, delta, p


def simulate(n_learners, seed=7):
    """Synthetic learners whose memory really follows HLR with a known theta (for a self-check)."""
    rng = np.random.default_rng(seed)
    true_theta = np.array([2.2, 0.9, -0.6, -0.4] + list(rng.normal(0, 0.3, 10)))
    out = io.StringIO()
    out.write("user_id,topic_id,delta_days,correct_before,wrong_before,mean_difficulty_before,recalled,submitted_at\n")
    for u in range(1, n_learners + 1):
        for topic in rng.choice(np.arange(1, 11), size=rng.integers(2, 6), replace=False):
            correct = wrong = 0
            mean_d = 0.0
            for k in range(rng.integers(3, 12)):
                d = float(rng.integers(1, 4))
                if k > 0:
                    delta = float(rng.exponential(6.0))
                    h = min(MAX_H, max(MIN_H, 2 ** float(true_theta @ features(correct, wrong, mean_d, topic))))
                    recalled = int(rng.random() < 2 ** (-delta / h))
                    out.write(f"{u},{topic},{delta:.6f},{correct},{wrong},{mean_d:.4f},{recalled},sim\n")
                else:
                    recalled = int(rng.random() < 0.6)
                n = correct + wrong
                mean_d = (mean_d * n + d) / (n + 1)
                correct += recalled
                wrong += 1 - recalled
    return out.getvalue()


def split_by_learner(users, test_share, seed=13):
    """Held-out learners, never rows of the same learner on both sides (no leakage)."""
    rng = np.random.default_rng(seed)
    unique = np.unique(users)
    rng.shuffle(unique)
    n_test = max(1, int(round(len(unique) * test_share))) if len(unique) > 1 else 0
    test_users = set(unique[:n_test].tolist())
    test = np.array([u in test_users for u in users])
    return ~test, test


# ---------------------------------------------------------------- model

def predict(theta, X, delta):
    h = np.clip(2.0 ** (X @ theta), MIN_H, MAX_H)
    return 2.0 ** (-delta / h), h


def train(X, delta, p, alpha=0.01, l2=0.1, epochs=3000, lr=0.02, init=None):
    """Full-batch Adam on the HLR loss."""
    n = len(p)
    pc = np.clip(p, *P_CLIP)
    log2_h_target = np.log2(np.clip(-np.maximum(delta, 1e-4) / np.log2(pc), MIN_H, MAX_H))
    theta = np.zeros(X.shape[1]) if init is None else np.array(init, dtype=float)
    m = np.zeros_like(theta)
    v = np.zeros_like(theta)
    ln2 = math.log(2)
    for t in range(1, epochs + 1):
        s = X @ theta
        h = 2.0 ** np.clip(s, math.log2(MIN_H), math.log2(MAX_H))
        p_hat = 2.0 ** (-delta / h)
        dp_ds = p_hat * ln2 * ln2 * delta / h
        dl_ds = 2 * (p_hat - pc) * dp_ds + 2 * alpha * (s - log2_h_target)
        grad = X.T @ dl_ds / n + 2 * l2 * theta / n
        m = 0.9 * m + 0.1 * grad
        v = 0.999 * v + 0.001 * grad * grad
        theta -= lr * (m / (1 - 0.9 ** t)) / (np.sqrt(v / (1 - 0.999 ** t)) + 1e-8)
    return theta


def auc(scores, labels):
    """Probability that a random recalled row scores higher than a random forgotten one (ties = 0.5)."""
    pos = scores[labels == 1]
    neg = scores[labels == 0]
    if len(pos) == 0 or len(neg) == 0:
        return None
    order = np.argsort(np.concatenate([pos, neg]), kind="mergesort")
    ranks = np.empty(len(order))
    combined = np.concatenate([pos, neg])[order]
    i = 0
    while i < len(combined):  # average ranks over ties
        j = i
        while j + 1 < len(combined) and combined[j + 1] == combined[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return float((ranks[:len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def metrics(p_hat, p):
    a = auc(p_hat, p)
    return {"mae_recall": round(float(np.mean(np.abs(p - p_hat))), 4), "auc": None if a is None else round(a, 4)}


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--data", help="CSV exported from /api/ml/training-data")
    src.add_argument("--url", help="export URL, e.g. http://localhost:8081/api/ml/training-data")
    src.add_argument("--simulate", type=int, metavar="LEARNERS", help="train on synthetic learners (self-check)")
    ap.add_argument("--out", default="hlr_weights.new.json", help="where to write the trained weights")
    ap.add_argument("--deploy", action="store_true", help="replace the shipped weights if the new model is better")
    ap.add_argument("--force", action="store_true", help="with --deploy: replace even if not better")
    ap.add_argument("--min-test-rows", type=int, default=200, help="refuse to deploy with fewer held-out rows")
    ap.add_argument("--test-share", type=float, default=0.2)
    ap.add_argument("--warm-start", action="store_true", help="start from the shipped theta instead of zeros")
    ap.add_argument("--fixtures", help="also write Java parity fixtures for the new weights to this path")
    args = ap.parse_args()

    if args.data:
        with open(args.data, encoding="utf-8") as f:
            text = f.read()
        source = "platform-export"
    elif args.url:
        with urllib.request.urlopen(args.url) as r:
            text = r.read().decode("utf-8")
        source = "platform-export"
    else:
        text = simulate(args.simulate)
        source = "synthetic"

    users, X, delta, p = load_rows(text)
    if len(p) < 20:
        sys.exit(f"Only {len(p)} training rows: practise more (or use --simulate) before retraining.")
    tr, te = split_by_learner(users, args.test_share)
    print(f"{len(p)} rows from {len(np.unique(users))} learners -> train {tr.sum()} / held-out {te.sum()}")

    with open(SHIPPED, encoding="utf-8") as f:
        shipped = json.load(f)
    init = shipped["theta"] if args.warm_start else None
    # Rounded exactly as written to the JSON, so metrics and parity fixtures describe what Java will load.
    theta = np.round(train(X[tr], delta[tr], p[tr], init=init), 6)

    p_new, _ = predict(theta, X[te], delta[te])
    p_old, _ = predict(np.array(shipped["theta"]), X[te], delta[te])
    new_m, old_m = metrics(p_new, p[te]), metrics(p_old, p[te])
    fixed7 = metrics(2.0 ** (-delta[te] / 7.0), p[te])
    avg = metrics(np.full(te.sum(), p[tr].mean()), p[te])
    print(f"held-out  new model : {new_m}")
    print(f"held-out  shipped   : {old_m}   ({shipped.get('model_version')})")
    print(f"baseline  fixed 7 d : {fixed7}")
    print(f"baseline  avg recall: {avg}")

    weights = {
        "feature_order": FEATURE_ORDER,
        "theta": [round(float(t), 6) for t in theta],
        "min_h": MIN_H,
        "max_h": MAX_H,
        "placeholder": False,
        "model_version": "hlr-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
        "data_source": source,
        "split": f"by learner, {round(args.test_share * 100)}% held-out",
        "warm_started_from": shipped.get("model_version") if args.warm_start else None,
        "frozen_indexes": [],
        "metrics": {**new_m, "n_train": int(tr.sum()), "n_test": int(te.sum()),
                    "baseline_fixed_7day": fixed7, "baseline_avg_recall": avg,
                    "shipped_model_on_same_test": old_m},
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(weights, f, indent=2)
    print(f"wrote {args.out}")

    if args.fixtures:
        cases = []
        for (c, w, d, t, dd) in [(0, 0, 0.0, 1, 0.0), (1, 0, 1.0, 2, 1.5), (3, 1, 1.5, 5, 7.0), (0, 4, 3.0, 10, 30.0),
                                 (8, 2, 2.2, 7, 12.0), (20, 0, 1.0, 9, 90.0)]:
            pp, h = predict(theta, features(c, w, d, t)[None, :], np.array([dd]))
            cases.append({"correct": c, "wrong": w, "mean_difficulty": d, "topic_id": t, "delta_days": dd,
                          "half_life_days": float(h[0]), "recall": float(pp[0])})
        with open(args.fixtures, "w", encoding="utf-8") as f:
            json.dump({"theta": weights["theta"], "min_h": MIN_H, "max_h": MAX_H, "tolerance": 1e-9,
                       "cases": cases, "sequences": []}, f, indent=2)
        print(f"wrote parity fixtures {args.fixtures}")

    if args.deploy:
        better = (new_m["auc"] is not None and old_m["auc"] is not None and new_m["auc"] >= old_m["auc"]
                  and new_m["mae_recall"] <= old_m["mae_recall"])
        enough = te.sum() >= args.min_test_rows
        if not args.force and not (better and enough):
            reason = "not better than the shipped model on held-out learners" if not better else \
                f"only {te.sum()} held-out rows (need {args.min_test_rows})"
            sys.exit(f"NOT deployed: {reason}. The shipped weights are unchanged.")
        with open(SHIPPED, "w", encoding="utf-8") as f:
            json.dump(weights, f, indent=2)
        print(f"deployed to {os.path.normpath(SHIPPED)}. Restart the backend to load it.")


if __name__ == "__main__":
    main()
