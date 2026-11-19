# DSA Coding Platform

An adaptive coding and data-structures-and-algorithms (DSA) learning platform. Learners solve
problems in Python or Java in the browser, and the platform tracks what they remember,
which topics they have unlocked, what kinds of mistakes they keep making, when each topic is due
for review, and how ready they are for interviews.

- **Frontend:** React 18, Vite 6, Tailwind CSS 4, CodeMirror 6, Recharts, React Router 7
- **Backend:** Spring Boot 3.3 (Java 17+), Spring Data JPA, H2 (file, default) or PostgreSQL
- **ML:** half-life regression (HLR) memory model, trained offline in Python, served by the backend,
  retrainable on the platform's own learners

## Features

| Area | What it does |
|---|---|
| Problems | 31 problems over a 10-topic prerequisite graph (at least one easy, medium and hard in every topic), with statements and samples. The editor starts empty: you write the whole program in Python or Java. A **Learn This Topic** tab on every problem has its key idea, two YouTube videos and two GeeksforGeeks articles |
| Code editor | CodeMirror with syntax highlighting, line numbers, bracket matching, search and auto-indent. Every visit to a problem starts with an empty editor (nothing is saved or restored; earlier submissions can be loaded from the Submissions tab). On laptops and larger the problem page is a one-screen workspace: the description, the code and the results each scroll on their own, so long code never moves the page |
| Run | Try code on the examples or your own input, with output, stderr and time per case, without it counting as an attempt |
| Judging | Every test in its own process inside a sandbox; a bounded judge queue shows "In queue #2" then "Running test 3 of 7" |
| Sandbox | Local: Java under a deny-all security manager, Python under an audit-hook guard, empty environment, process-tree kill. Docker: one locked-down container per run (no network, read-only, CPU / memory / process limits) |
| Results | Verdict per test, progressive hints, runtime percentile among accepted solutions, peak memory (Docker sandbox), submission history, and study links that open the GeeksforGeeks tutorial for the topic directly |
| Mistake analysis | Classifies every failed submission (wrong approach, missed edge case, off-by-one, too slow, ...) |
| Retention (ML) | Predicts how well each topic is remembered, with a confidence level |
| Review queue | Topics fading below the unlock threshold, each with a problem to re-solve |
| Topic map | Prerequisite graph; a topic unlocks when its prerequisites are retained and solved. Opening a problem in a locked topic first suggests an easier question to practise, with an "I still want to proceed" option |
| Recommendations | Ranked next problems from unlocked topics, with a reason for each |
| Study plans | Curated sequences with progress. The Full Path is grouped by topic: one row per topic with its solved count and progress bar, opened to see its problems |
| Mock interviews | Timed sets of 2-3 problems; pick mixed (easy to harder) or one difficulty; counts real submissions |
| Activity | Calendar heatmap, day streak and longest streak |
| Readiness | Right answers, memory, practising often and speed combined into a 0-100 score, explained in plain English, with "points ahead / behind the level you expected" against the learner's own rating and a next step per topic |
| Solve timer | Optional stopwatch or countdown on each problem |
| Interface | Light (default) and dark themes, glass styling, sliding page transitions, responsive down to phones |

There is no login: the sidebar has a demo-learner switcher (Rahul and Ananya; they were called Alex and Sam
before, and keep all of their earlier progress).

## Repository layout

```
backend/                      Spring Boot application
  src/main/java/.../controller    REST endpoints (/api/...)
  src/main/java/.../judge         bounded judge queue with progress
  src/main/java/.../runner        compile + run per language, local and Docker sandboxes
  src/main/java/.../learner       HLR predictor, readiness, recommendations, unlock rule, hints
  src/main/java/.../service       business logic behind each endpoint
  src/main/resources/
    application.yml               configuration (port, sandbox, queue, limits, profiles)
    schema.sql, data.sql          schema and seed data (topics, problems, tests, users, study plans)
    runner/                       Java security policy and Python guard for the local sandbox
    ml/hlr_weights.json           trained HLR model weights
  Dockerfile
frontend/                     React app (see frontend/README.md), Dockerfile, nginx.conf
ml/                           retraining pipeline for the HLR model (see ml/README.md)
docs/CONTRACT.md              API, database, domain-rule and ML-file contract
docker-compose.yml            PostgreSQL + backend + frontend
start.sh, start.ps1           one-command local start
.github/workflows/ci.yml      tests and builds on every push
```

## Running

### One command (local, no Docker)

**Install once:** a JDK 17 or newer (https://adoptium.net), Maven (https://maven.apache.org) and
Node.js 20 or newer (https://nodejs.org). Python 3.8+ is optional (adds Python solutions).

**Windows:** open the project folder (the one with `start.cmd` in it) and **double-click `start.cmd`**,
or run it from a terminal in that folder:

```bash
.\start.cmd
```

**macOS / Linux:**

```bash
bash start.sh
```

The first start downloads libraries and takes a few minutes; later starts take about 20 seconds.
The script checks the tools, builds and starts the backend (http://localhost:8081), then starts the
frontend and opens http://localhost:5173. Keep the window open while using the site; Ctrl+C (or
closing the window) stops it. Your data is kept in `backend/data`.

If something is wrong the script says what, e.g. a missing tool, or that port 5173 is already in use
because the site is already running in another window.

### Docker (everything, with PostgreSQL)

```bash
docker compose up --build
```

Open http://localhost:8080 (`APP_PORT` changes the port). nginx serves the app and forwards `/api`
to the backend; PostgreSQL keeps data in a named volume.

### Manually

```bash
cd backend && mvn spring-boot:run
```

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Configuration

| Setting | Where | Default |
|---|---|---|
| `BACKEND_URL` | `frontend/.env` | `http://localhost:8081` |
| `PORT` | environment | `8081` |
| `RUNNER_SANDBOX` | environment | `local` (`docker` for container isolation) |
| `RUNNER_PYTHON` | environment | auto-detected `python3` / `python` |
| `JUDGE_WORKERS` | environment | half the CPU cores, at most 4 |
| `DATA_DIR` | environment (default H2 profile) | `./data` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | environment (postgres profile) | `localhost`, `5432`, `dsa_platform`, `dsa`, `dsa` |
| `CORS_ORIGIN` | environment | `http://localhost:5173` |
| `LOCAL_ONLY` | environment | `true`: only this computer may call the backend (Docker sets `false`) |
| `APP_HOST` | environment (docker compose) | `127.0.0.1`: the site is reachable only from this computer |
| rate limits, code size, queue size, unlock thresholds | `backend/src/main/resources/application.yml` | see `docs/CONTRACT.md` section 7 |

No API keys or external services are required.

## ML model

Retention uses half-life regression. For each learner and topic the backend builds a 14-value
feature vector (bias, `sqrt(1 + correct)`, `sqrt(1 + wrong)`, mean difficulty, one-hot topic):

```
half_life_days = clamp(2^(theta · x), 0.25, 180)
predicted_retention = 2^(-days_since_last_practice / half_life_days)
```

The shipped weights are a trained model (`hlr-20261016-183648`, Codeforces data, split by learner):
test AUC 0.556 vs 0.512 for a fixed 7-day baseline, MAE 0.456 vs 0.502. Retention drives the topic
map, unlocks, recommendations, the review queue and readiness. Each prediction shows a confidence
(low / medium / high) based on how many attempts it rests on.

`ml/train_hlr.py` retrains the model on the platform's own attempt history
(`GET /api/ml/training-data`) and replaces the shipped weights only if the new model is better on
held-out learners. See `ml/README.md`.

## Tests

```bash
cd backend && mvn test        # 81 tests
cd frontend && npm test       # 29 tests
python ml/train_hlr.py --simulate 400 --out /tmp/w.json   # trainer self-check
```

Backend tests cover the runner and both sandboxes (including escape attempts for Java and Python),
the judge queue, hints, the HLR predictor and its Python parity fixtures, readiness,
recommendations, the unlock rule, submission evaluation, streaks, the training export and an
application-startup test. GitHub Actions runs all three on every push.

## API

All endpoints are under `/api`; full shapes are in `docs/CONTRACT.md` section 5.

| Method | Path | Used by |
|---|---|---|
| POST | `/submissions` | Submit and wait for the verdict |
| POST, GET | `/submissions/jobs`, `/submissions/jobs/{id}` | Submit through the queue and poll progress |
| POST | `/run` | Run on examples or custom input (not recorded) |
| GET | `/languages` | Language picker |
| GET | `/users` | Learner switcher |
| GET | `/users/{id}/retention` | Topic map |
| GET | `/users/{id}/recommendations?limit=5` | Today |
| GET | `/users/{id}/review?horizonDays=3` | Today: due for review |
| GET | `/users/{id}/activity?days=182` | Today: heatmap and streaks |
| GET | `/users/{id}/weakness` | Mistakes |
| GET | `/users/{id}/readiness` | Today, Readiness |
| POST | `/users/{id}/self-rating` | Readiness |
| GET | `/users/{id}/problems/{pid}/submissions` | Problem page: submission history |
| GET | `/users/{id}/problem-status` | Mock interviews |
| GET | `/study-plans?userId={id}` | Study plans |
| GET | `/topics/graph?userId={id}` | Topic map, Problems, Mock interviews |
| GET | `/problems?topicId=&difficulty=` | Problems |
| GET | `/problems/{id}` | Problem page (statement, formats, samples) |
| GET | `/ml/model`, `/ml/training-data` | Topic map model note, retraining |

## Changes in this version

- **Frontend integrated.** The React frontend lives in `frontend/` next to the backend.
- **Trained ML model** instead of the earlier placeholder, with Java/Python parity tests.
- **Code-runner output cap** raised from 64 KB to 1 MB (correct solutions to two problems failed).
- **Redesigned interface:** light and dark themes, glass styling, page transitions, sidebar,
  stopwatch / timer, larger editor.
- **Safer judging:** sandboxed runner (local hardening or Docker), bounded judge queue with live
  progress, rate limits and a code-size limit.
- **Coding experience:** CodeMirror editor, Python (default) and Java, Run with custom
  input, submission history, runtime percentile, progressive hints.
- **Learning features:** review queue, activity heatmap and streaks, study plans, mock interviews,
  prediction confidence.
- **Model retraining** on the platform's own data (`ml/`).
- **Persistence:** the default database is a file, so progress survives restarts.
- **Engineering:** code splitting (first load ~70 KB gzipped instead of ~216 KB), frontend tests,
  CI, Dockerfiles with docker-compose, and one-command start scripts.
- **Run and Submit always reachable:** the buttons sit in the editor's top bar (they used to fall
  below the bottom of a laptop screen), a double click submits only once, and the run output and
  verdict scroll into view.
- **No starter code:** the editor starts empty and you write the whole program. The starter code is
  removed from the database (schema.sql drops the old column) and from the API.
- **Learners renamed:** Alex is now Rahul and Sam is now Ananya. They keep their ids, so all
  earlier submissions, mistakes, ratings and readiness history stay with the same person.
- **Beginner-friendly Readiness page** and a gap shown as "points ahead / behind" instead of +19 / -20.8.
- **Locked problems** ask you to practise first, with a way through.
- **GeeksforGeeks links** open the real topic tutorial instead of a Google search.
- **Python and Java only:** C++ is removed from the editor, the API and the runner (a C++ request is
  a 400). Python is the default language. Old C++ attempts, if any, stay in the history.
- **Clean results:** every Run or Submit clears the previous output, errors and verdict at once and
  shows a loading state; a slow older request can never overwrite a newer result.
- **Learn This Topic:** every problem has a tab with its key idea, two YouTube videos (playable in
  the page or on YouTube) and two GeeksforGeeks articles, all chosen for that problem and checked.
- **Plain words everywhere:** "memory score" instead of retention, "memory halves in about N days"
  instead of half-life, plain mistake names, test kinds and recommendation reasons; the model's
  technical details are kept behind a "Technical details" link on the Topic map.
- **Mock interview results** appear only on the Mock interview page; other pages show just the
  countdown while an interview is running.
- **Problem page workspace:** the header, Run and Submit stay put; only the editor (and, separately,
  the description and the results) scroll. The editor starts empty on every visit; code is no
  longer saved in the browser, and copies saved by older versions are removed.
- **Full audit fixes:** parallel submissions or ratings of the same learner can no longer
  overwrite each other or fail; a judge job that hits a Java `Error` no longer stays "running"
  forever; Run checks the learner exists (the rate limit could be dodged); a rating of 2.5 is
  rejected instead of saved as 2; every error, including unknown paths and wrong methods, has the
  same `{ error, message }` body; Java code without a runnable `Main` gets a clear compile message;
  only this computer can call the backend (and, in Docker, reach the site and the database);
  a page that crashes shows a message instead of blanking the app; React Router 7 (security fix).

## Known limitations

- The local sandbox is defence in depth, not a hard boundary; use the Docker sandbox when strangers
  can submit code.
- The Docker sandbox and the Docker images are covered by unit tests of their configuration but
  were not run end to end in this environment (no Docker available).
- Peak memory is reported only by the Docker sandbox.
- There is no real login, so the API trusts the learner id it is given. To limit the risk, the
  backend answers only requests from the computer it runs on (`LOCAL_ONLY`).
- The model's AUC (0.556) is only modestly above the baselines; retraining on real usage should help.
