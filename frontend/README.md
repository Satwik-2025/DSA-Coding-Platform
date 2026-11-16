# Frontend (React + Vite + Tailwind + Recharts)

Talks only to the endpoints in `docs/CONTRACT.md` section 5. Every call is in `src/api.js`.

## Run

Needs Node 18+ and the backend running.

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173.

The browser calls `/api/...` on port 5173 and Vite forwards it to Spring Boot
(see `vite.config.js`). The backend port is read from `.env`:

    copy .env.example .env      (Windows)   |   cp .env.example .env   (Mac/Linux)

Default is `http://localhost:8081`, which is what `application.yml` sets today.

## Pages

| Route | Shows | Endpoints |
|---|---|---|
| `/` | Overall readiness, recommended problems | 5.6, 5.4 |
| `/topics` | Prerequisite graph with lock state and retention | 5.8, 5.3 |
| `/problems` | Problem list with topic / difficulty filters | 5.9, 5.8 |
| `/problems/:id` | Statement, samples, code box, submission result | 5.10, 5.1 |
| `/readiness` | Readiness history chart, per-topic scores, self-rating | 5.6, 5.7 |
| `/mistakes` | Recurring mistake types with study links | 5.5 |

The learner switcher in the header uses `GET /api/users` (5.2). There is no login.

## Files

    src/api.js           every backend call, one line per endpoint
    src/useApi.js        loading / error / data hook used by every page
    src/UserContext.jsx  current demo learner
    src/format.js        number/date formatting, enum labels
    src/components/      layout, badges, error box, study-link list
    src/pages/           one file per route
