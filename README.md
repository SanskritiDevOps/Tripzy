# Tripzy

**Plan group trips together, in real time.** Tripzy is a collaborative trip planner where friends collect places, vote on them, build a day-by-day itinerary (by hand or with AI), split expenses and share a packing list. Every change appears instantly for everyone in the trip.

**Live demo:** [tripzy-lovat.vercel.app](https://tripzy-lovat.vercel.app). It runs on free hosting, so the first request after a quiet period can take up to a minute while the server wakes up.

---

## The problem

Planning a trip with friends usually happens across several apps at once:

- **Deciding where to go** happens in long group chats and polls, where ideas get lost and there's no clear winner.
- **The plan** lives in shared notes or documents that get out of date, with no map, timings or travel times.
- **Money** is tracked in spreadsheets or from memory, which leads to mistakes and awkward "who owes whom" conversations.
- **Staying in sync** means constant messages, and everyone ends up with a different version of the plan.

Tripzy brings all of this into one shared workspace that updates live for the whole group.

---

## Features

**Trips and teamwork**
- Create a trip with a destination and dates; the creator becomes the **Team Leader**.
- Invite friends by email with a personal, expiring join link.
- Roles with clear permissions: members can add and edit places, stops, expenses and packing items, while the leader controls the budget, invitations, member removal and locks.
- A shared **activity feed** shows who did what ("Aman added Amber Fort", "Riya paid ₹3,000").

**Places and voting**
- Search real places anywhere in the world on a map (OpenStreetMap), or drop a pin for places the map doesn't know.
- Upvote or downvote places to build a ranked "Most popular" list, and close voting to lock in the winners.
- The leader can lock places so they can't be changed.

**Itinerary: manual, AI or both**
- **Manual:** drag ideas onto days, reorder stops, and move stops between days; start times re-flow automatically, with travel time between stops.
- **AI:** pick the days, places and time to spend at each, plus the day's hours, pace and interests ("we love street food"). Google Gemini proposes an ordered plan with meal timing and tips, and you review a preview before saving.
- **Hybrid:** lock the stops you want to keep and regenerate the rest of a day, or fill only the gaps around existing stops.
- Day-by-day route map, and protection against two people overwriting the same stop.

**Expenses**
- Split costs equally, by exact amounts or by percentage.
- See each person's balance and a **simplified settle-up**: the fewest payments needed to clear every debt.
- Record payments, track spending against a group budget, and keep former members' shares and balances intact.

**Packing list**
- A shared checklist with categories, where items can be assigned to a person.

**Live collaboration**
- Changes appear on everyone's screen within seconds, with **who's online** indicators.
- Reconnects automatically and catches up after a dropped connection.

**Also included**
- Sign in with email and password, or with Google.
- **Example trips** showing what a fully planned trip looks like.
- Works on phones, tablets and desktops.
- Friendly recovery screens instead of a blank page if something goes wrong.

---

## Tech stack

| Area | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, React Router 7, Zustand, React Hook Form + Zod, Leaflet (OpenStreetMap), dnd-kit, Socket.IO client |
| **Backend** | Node.js 22, Express 5, Socket.IO, Prisma 7, Zod, JSON Web Tokens + bcrypt, Google Identity Services, Nodemailer, Helmet, express-rate-limit, Pino |
| **Database** | PostgreSQL 16 (optional Redis for scaling live updates across servers) |
| **AI and maps** | Google Gemini (itinerary planning), OpenStreetMap Nominatim (place search and geocoding) |
| **Testing** | Vitest and Supertest: API tests against a real PostgreSQL database, plus unit tests for the web app’s money, settle-up, permission and planning logic |
| **Hosting** | Vercel (frontend), Render (API), Neon (PostgreSQL); Docker Compose for local development |

---

## System architecture

Tripzy has two parts: a React single-page app (`Frontend/`) and a Node.js API (`Backend/`) that serves both a REST interface and live WebSocket connections, backed by PostgreSQL.

**Request flow.** The frontend is hosted on Vercel. Its `/api` requests are forwarded by Vercel to the API, so the login cookie stays on the same site as the app. The live-update connection goes directly to the API.

**API structure.** The API is organised into modules by domain: auth, trips, places, itinerary, expenses, packing, invites, activities and maps. Every request passes through three checks:
1. Authentication: a short-lived access token.
2. Trip membership and role.
3. Input validation with Zod.

Writes run in database transactions that also record the matching activity-feed entry, so the data and its history never disagree.

**Real-time updates.** All changes go through the REST API. After a change is saved, the server sends a small "this part of the trip changed" message to everyone in that trip's Socket.IO room, and their apps re-fetch just that part. This keeps validation and permissions in one place, and a missed message can never leave anyone with wrong data. Room membership also powers the "who's online" indicators. An optional Redis adapter lets several API servers share rooms.

**AI planning.** The work is split so each side does what it's good at:
- Code groups places by distance, estimates travel times and sends Gemini a structured brief.
- Gemini decides the order, meal timing and tips, answering in strict JSON.
- The server validates and repairs the answer: unknown or duplicate places are dropped, and times are fitted around travel and locked stops. It retries once with the problems listed.
- If the AI is unavailable, it falls back to a route-based plan, so planning always works.

**Maps.** Place searches go through the API to OpenStreetMap's Nominatim service, with caching and request spacing that follow its usage policy. Each trip's destination is geocoded once, so maps and the planner centre on the real location.

**Email.** Invite emails are sent from Gmail with Nodemailer. Free API hosting blocks email ports, so in production the API hands each email to a small Vercel Function that sends it.

**Data and correctness.**
- Money is stored as whole paise (no floating-point errors), and splits are always calculated on the server.
- Itinerary stops carry a version number, so a stale edit is rejected rather than silently overwriting someone else's change.
- Expense creation is idempotent, so a double-click never records an expense twice.

**Security.**
- Passwords are hashed with bcrypt.
- Access tokens last 15 minutes and are kept in memory, never in browser storage.
- Refresh tokens are stored hashed, rotated on every use, and revoked if a reused token is detected.
- Permissions are enforced on the server for every request and live connection. The UI only hides what you can't do.
- Also: security headers, a strict allowed-origins list, and rate limits on logins and costly endpoints.

---

## Project structure

```
Frontend/   React app (src/), unit tests (tests/), Vercel config and the mail-relay function (api/)
Backend/    Express API (src/), Prisma schema and migrations (prisma/), tests (tests/)
docker-compose.yml   PostgreSQL and Redis for local development
render.yaml          Render deployment blueprint for the API
DEPLOYMENT.md        Step-by-step free deployment guide
```

---

## Running locally

**Requirements:** Node.js 22.6 or newer, and Docker.

```bash
git clone https://github.com/SanskritiDevOps/Tripzy.git
cd Tripzy
docker compose up -d                 # PostgreSQL and Redis

# API
cd Backend
cp .env.example .env                 # set JWT_ACCESS_SECRET (a long random string)
npm install
npm run db:migrate
npm run dev                          # http://localhost:5000

# Web app (in a second terminal)
cd Frontend
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

Google sign-in, AI planning (`GEMINI_API_KEY`) and invite emails (`SMTP_URL`) are optional; each is described in `Backend/.env.example`. Without them, the app still works: the Google button is hidden, the route-based planner is used, and invite links can be copied instead of emailed.

**Tests:** run `npm test` in `Frontend/`. For the API tests, create a test database once with `docker compose exec postgres psql -U tripzy -c "CREATE DATABASE tripzy_test;"`, then run `npm test` in `Backend/`.

---

## Deployment

The app can be deployed entirely on free plans (Vercel, Render and Neon). See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the step-by-step guide.
