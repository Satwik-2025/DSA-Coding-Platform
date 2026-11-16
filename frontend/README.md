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

The learner switcher in the sidebar (or the mobile menu) uses `GET /api/users` (5.2). There is no login.

## Design

- **Themes:** light (default, soft off-white with bronze accents) and dark (warm black with
  champagne accents). The toggle sits at the bottom of the sidebar or in the mobile top bar. The
  choice is saved in `localStorage` (`theme`) and applied in `index.html` before first paint, so
  there is no flash. Every colour is a CSS variable in `src/index.css`.
- **Glass surfaces:** `glass` / `glass-strong` utilities (translucent fill, blur, hairline border,
  soft shadow) for the sidebar, cards, tables, dropdowns and panels.
- **Navigation:** a collapsible sidebar on desktop (state saved as `sidebar`), and a top bar with a
  slide-in menu below 1024px.
- **Motion:** pages slide horizontally in the direction of travel through the menu order; sub-pages
  fade up. Durations stay under half a second, and all motion is switched off under
  `prefers-reduced-motion`.

## Files

    src/api.js                       every backend call, one line per endpoint
    src/useApi.js                    loading / error / data hook used by every page
    src/UserContext.jsx              current demo learner
    src/theme.jsx                    dark/light theme state, toggle, chart colours
    src/format.js                    number/date formatting, enum labels
    src/index.css                    design tokens, glass/button/field/table styles, animations
    src/components/Layout.jsx        sidebar, mobile top bar and menu
    src/components/AnimatedRoutes.jsx  sliding page transitions around the routes
    src/components/Select.jsx        styled, keyboard-accessible dropdown
    src/components/ThemeToggle.jsx   dark/light switch
    src/components/Icons.jsx         inline SVG icons
    src/components/                  also badges, status (loading / error / empty), study-link list
    src/pages/                       one file per route
