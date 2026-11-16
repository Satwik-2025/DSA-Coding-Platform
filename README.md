# DSA Coding Platform

An adaptive coding and data-structures-and-algorithms (DSA) learning platform. Learners
solve Java problems in the browser, and the platform tracks what they remember, which
topics they have unlocked, what kinds of mistakes they keep making, and how ready they
are for interviews.

- **Frontend:** React 18, Vite 6, Tailwind CSS 4, Recharts, React Router
- **Backend:** Spring Boot 3.3 (Java 17+), Spring Data JPA, H2 (default) or PostgreSQL
- **ML:** half-life regression (HLR) memory model, trained offline in Python and
  served by the backend

## Features

| Area | What it does |
|---|---|
| Problems | 15 seeded problems over a 10-topic prerequisite graph, with statements, samples and starter code |
| Code runner | Compiles and runs Java submissions against sample, edge, boundary and large tests, each in its own process with time and memory limits |
| Solve timer | Optional stopwatch or countdown timer on each problem (pause, reset, chime when time is up); a personal aid that doesn't affect the time recorded with a submission |
| Mistake analysis | Classifies every failed submission (wrong algorithm, missed edge case, off-by-one, bad complexity, and so on) and links study resources |
| Retention (ML) | Predicts how well each topic is remembered using the trained HLR model |
| Topic map | Prerequisite graph; a topic unlocks when its prerequisites are retained and solved |
| Recommendations | Ranks the next problems to solve from the unlocked topics, with a reason for each |
| Readiness | Combines accuracy, retention, consistency and speed into a 0–100 score and compares it with the learner's self-rating |

There is no login: the header has a demo-learner switcher (Alex and Sam).

## Repository layout

```
backend/                     Spring Boot application
  src/main/java/.../controller   REST endpoints (/api/...)
  src/main/java/.../learner      HLR predictor, readiness, recommendations, unlock rule, submission evaluation
  src/main/java/.../runner       Java code runner (javac + java per test)
  src/main/java/.../service      Business logic behind each endpoint
  src/main/resources/
    application.yml              Configuration (port, CORS, thresholds, profiles)
    schema.sql, data.sql         Database schema and seed data (topics, problems, tests, users)
    ml/hlr_weights.json          Trained HLR model weights
  src/test/                      Unit and integration tests, incl. ML parity fixtures
frontend/                    React single-page app (see frontend/README.md)
docs/CONTRACT.md             API, database, domain-rule and ML-file contract
docker-compose.yml           Optional PostgreSQL database
```

## ML model

Retention uses half-life regression. For each learner and topic the backend builds a
14-value feature vector (bias, `sqrt(1 + correct)`, `sqrt(1 + wrong)`, mean difficulty,
and a one-hot topic), then computes:

```
half_life_days = clamp(2^(theta · x), 0.25, 180)
predicted_retention = 2^(-days_since_last_practice / half_life_days)
```

The weights in `backend/src/main/resources/ml/hlr_weights.json` are a trained model:

| | |
|---|---|
| Model version | `hlr-20261016-183648` |
| Training data | Codeforces submissions, split by learner, 20% held out |
| Test MAE (recall) | 0.4563, vs 0.5016 for a fixed 7-day baseline |
| Test AUC | 0.5559, vs 0.5118 for the same baseline |

The backend validates the file at startup and refuses to start if the feature order
or the number of weights is wrong. Predicted retention drives the topic map, unlocks,
recommendations and readiness. `HlrFixtureParityTest` checks that the Java predictor
reproduces the Python trainer's outputs. See `docs/CONTRACT.md` sections 4.3 and 6.

## Running locally

**Prerequisites:** Java 17 or newer, Maven 3.9+, Node.js 18 or newer.

1. Start the backend (port 8081, in-memory H2 database seeded on every start):

   ```bash
   cd backend
   mvn spring-boot:run
   ```

2. In a second terminal, start the frontend (port 5173):

   ```bash
   cd frontend
   cp .env.example .env      # Windows: copy .env.example .env
   npm install
   npm run dev
   ```

3. Open http://localhost:5173.

The browser only talks to port 5173; Vite forwards `/api` to the backend URL in
`frontend/.env`.

### Optional: PostgreSQL

```bash
docker compose up -d
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=postgres
```

Set `DB_PORT` (default 5432) for both commands if that port is already in use.

## Configuration

| Setting | Where | Default |
|---|---|---|
| `BACKEND_URL` | `frontend/.env` | `http://localhost:8081` |
| `server.port` | `backend/src/main/resources/application.yml` | `8081` |
| `app.cors.allowed-origin` | `application.yml` | `http://localhost:5173` |
| `app.unlock.min-retention`, `app.unlock.min-correct-count` | `application.yml` | `0.6`, `2` |
| `app.hlr.weights-path` | `application.yml` | `classpath:ml/hlr_weights.json` |
| `DB_PORT` | environment (PostgreSQL profile only) | `5432` |

No API keys or external services are required.

## Tests

```bash
cd backend
mvn test
```

46 tests cover the HLR predictor and its Python parity fixtures, readiness,
recommendations, the unlock rule, submission evaluation, the code runner, and an
application-startup test.

## API

All endpoints are under `/api`; full request and response shapes are in
`docs/CONTRACT.md` section 5.

| Method | Path | Used by |
|---|---|---|
| POST | `/submissions` | Problem page (run and grade code) |
| GET | `/users` | Learner switcher |
| GET | `/users/{id}/retention` | Topic map |
| GET | `/users/{id}/recommendations?limit=5` | Dashboard |
| GET | `/users/{id}/weakness` | Mistakes page |
| GET | `/users/{id}/readiness` | Dashboard, Readiness page |
| POST | `/users/{id}/self-rating` | Readiness page |
| GET | `/topics/graph?userId={id}` | Topic map, Problems page |
| GET | `/problems?topicId=&difficulty=` | Problems page |
| GET | `/problems/{id}` | Problem page |

## What changed in this version

- **Frontend integrated.** The React frontend now lives in `frontend/` in the same
  repository as the backend. Its code is unchanged; it uses every endpoint above.
- **Trained ML model.** `hlr_weights.json` is the trained Codeforces model instead of
  the earlier hand-written placeholder, so the startup placeholder warning no longer
  appears. `HlrPredictorTest` now checks that the shipped file is the trained one, and
  `HlrFixtureParityTest` with its fixtures was added.
- **Code-runner fix.** The runner kept only 64 KB of program output, so correct
  solutions to *Rotate Array by k* and *Longest Common Prefix* failed their large tests
  (their expected output is about 380 KB and 190 KB). The cap is now 1 MB per test.
- **Cleanup.** Removed the old weights backup, IDE settings and build output, and
  repaired `.gitignore`.
- **Docs.** This README was added, and `docs/CONTRACT.md` plus outdated code comments
  were updated to match the running system (port 8081, all endpoints implemented, runner
  limits, shipped model).

## Known limitations

- The default H2 database is in memory, so attempts are lost when the backend stops.
  Use the PostgreSQL profile to keep them.
- Submissions are Java only.
- The model's AUC (0.556) is only modestly above the baselines.
- The offline Python training pipeline is not part of this repository; only its output
  (the weights and the parity fixtures) is.
