# Tripzy: Real-Time Group Trip Planner

> Plan trips together. Add places, vote, split expenses, and build a day-by-day itinerary, manually or with AI, with every change appearing live for everyone.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Features](#4-features)
5. [Tech Stack](#5-tech-stack)
6. [System Architecture](#6-system-architecture)
7. [Database Design](#7-database-design)
8. [API Design](#8-api-design)
9. [Real-Time Events (Socket.IO)](#9-real-time-events-socketio)
10. [Key Algorithms and Design Decisions](#10-key-algorithms-and-design-decisions)
11. [AI Itinerary Design](#11-ai-itinerary-design)
12. [Security](#12-security)
13. [Folder Structure](#13-folder-structure)
14. [Environment Variables](#14-environment-variables)
15. [Local Setup](#15-local-setup)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment](#17-deployment)
18. [Build Roadmap (50 Days)](#18-build-roadmap-50-days)
19. [Interview Talking Points](#19-interview-talking-points)
20. [Future Scope](#20-future-scope)

---

## 1. Overview

Tripzy is a collaborative web app where a group of friends plans a trip in one shared space. Instead of juggling WhatsApp polls, Google Sheets for expenses, and random notes for the itinerary, everything lives in one place and updates **live** for every member.

**What users can do**

- Create a trip and invite friends with a link
- Search and add places on a map
- Vote on which places to visit
- Track shared expenses and see who owes whom
- Build the itinerary manually, let AI generate it, or mix both
- See every change instantly, without refreshing

---

## 2. Problem Statement

Planning a group trip is messy:

| Pain point | Today's workaround | Problem |
|---|---|---|
| Deciding where to go | WhatsApp polls and long chats | Ideas get lost, no clear winner |
| Building a plan | Shared notes or docs | Conflicting edits, no map, no timing |
| Splitting money | Spreadsheets or memory | Errors, awkward "who owes what" arguments |
| Staying in sync | Constant messages | Everyone has a different version of the plan |

Tripzy solves all four in one real-time workspace.

---

## 3. Goals and Non-Goals

### Goals
- A deployed, working product that a real group can use to plan a real trip
- Real-time collaboration that stays consistent under concurrent edits
- Correct and explainable expense math
- AI itinerary generation that is reliable and validated, not blindly trusted
- Clean code, tests on critical logic, and clear documentation

### Non-Goals (for the first release)
- Flight and hotel booking
- Payment processing (it only *tracks* who owes whom)
- Native mobile apps (the web app is responsive instead)
- Production-scale infrastructure (the app targets small groups, not millions of users)

---

## 4. Features

Features are grouped by priority. Build **P0 first**, then P1, then pick a few from P2.

### P0: Core (must have)

#### 4.1 Authentication and Accounts
- Sign up and log in with email and password
- Optional Google login
- JWT access tokens plus refresh tokens
- Profile with name and avatar

#### 4.2 Trips and Members
- Create a trip with name, destination, start date, and end date
- Invite via a shareable link (with an expiry) or by email
- Roles: **Owner** (can edit trip settings, remove members, delete the trip) and **Member**
- View all trips you belong to
- Leave a trip, or remove a member (owner only)

#### 4.3 Places Board
- Search places on a map (OpenStreetMap-based search)
- Add a place with name, address, coordinates, category, notes, and estimated time to spend (for example, "2 hours")
- See who added each place
- Filter by category (food, sights, stay, activity)
- Edit and delete your own places

#### 4.4 Voting
- Upvote or downvote any place (one vote per user per place)
- Change or remove your vote
- Live vote counts and a ranked "Most Popular" list
- Optional voting deadline; after it closes, the winners are locked

#### 4.5 Expense Splitting
- Add an expense: title, amount, currency, who paid, and who shared it
- Split types: **equal**, **exact amounts**, **percentage**
- Per-person balance screen: "Rahul owes Aman ₹1,200"
- **Simplified settlements**: the fewest possible payments to clear all debts
- Mark a payment as settled
- Edit and delete expenses (with an activity log entry)

#### 4.6 Itinerary (Manual, AI, or Hybrid)
- **Manual mode:** create days, drag places into days, set start time and duration for each stop
- **AI mode:** provide places, time at each place, and number of days, and the AI generates the plan
- **Hybrid mode:** generate with AI, then edit by hand; lock specific stops and regenerate the rest; regenerate a single day
- All three modes save to the same data structure

#### 4.7 Live Collaboration
- Places, votes, expenses, and itinerary changes appear instantly for everyone in the trip
- Automatic reconnection and state re-sync after a dropped connection

### P1: Stand-Out Features (pick 3 to 4)

| Feature | Why it impresses |
|---|---|
| **Presence indicators** ("3 people online", "Priya is editing Day 2") | Shows real-time depth |
| **Edit locks / conflict handling** on itinerary items | Shows you understand concurrency |
| **Route optimization**: order each day's stops to reduce travel distance and show travel time between stops | Combines algorithms with maps |
| **Map view**: pins colored by day, with the route drawn | Great demo moment |
| **Activity feed**: "Aman added Taj Mahal", "Riya paid ₹3,000" | Makes live updates visible |
| **Weather per day** on the itinerary | Easy win with a free API |
| **Public read-only share link** for the final itinerary | Useful and simple |

### P2: Nice to Have (only if time remains)

- Offline mode (PWA) so the itinerary is readable without signal
- Multi-currency expenses with exchange rates
- Comments and emoji reactions on places
- Email notifications (voting opens, new expense, trip reminder)
- Export itinerary as PDF
- Natural-language edits to the plan ("make Day 2 more relaxed")
- AI packing list based on destination and weather
- UPI deep link for settling up

---

## 5. Tech Stack

### Frontend

| Tool | Purpose |
|---|---|
| **React + Vite** | UI framework and fast dev tooling |
| **JavaScript (ES modules, JSX)** | Language for the whole app; Zod covers runtime validation |
| **Tailwind CSS v4** (`@tailwindcss/vite`) | Quick, clean, responsive styling |
| **React Router** | Page routing |
| **TanStack Query** (+ Devtools in dev) | Fetching, caching, and syncing server data |
| **Zustand** | Small client-side state (auth user, UI state, socket status) |
| **Socket.IO Client** | Live updates |
| **dnd-kit** (`core`, `sortable`, `utilities`) | Drag-and-drop itinerary editing |
| **Leaflet + react-leaflet** | Interactive maps (free, uses OpenStreetMap) |
| **React Hook Form + Zod + @hookform/resolvers** | Forms and validation |
| **Recharts** (optional) | Expense charts |

### Backend

| Tool | Purpose |
|---|---|
| **Node.js + Express 5** (JavaScript, ES modules) | REST API server |
| **Socket.IO** + `@socket.io/redis-adapter` | Real-time layer with rooms (one room per trip), auto-reconnect, multi-server ready |
| **jsonwebtoken + bcryptjs** | Authentication and password hashing |
| **cookie-parser** | Read the refresh token from an httpOnly cookie |
| **Zod** | Request and AI-output validation |
| **Prisma 7** + `@prisma/adapter-pg` + `pg` | ORM, migrations, and the Postgres driver adapter Prisma 7 requires |
| **ioredis** | Redis client (presence, edit locks, caching) |
| **Helmet, CORS, express-rate-limit + rate-limit-redis** | Security basics and shared rate limits |
| **Pino + pino-http** (`pino-pretty` in dev) | Structured logging and request logs |
| **dotenv** | Load environment variables |

### Database and Cache

| Tool | Purpose |
|---|---|
| **PostgreSQL** | Main database (users, trips, places, votes, expenses, itinerary) |
| **Redis** | Socket.IO adapter, presence tracking, caching map/weather results, rate limiting |

### AI

| Tool | Purpose |
|---|---|
| **One LLM API** (Gemini free tier, OpenAI, or Claude) | Itinerary generation |
| **Zod** | Validate the AI's JSON output before saving |

> Keep all LLM calls behind one function, `generateItinerary()`, so you can swap providers later (or plug in your LLM Gateway project).

### Third-Party APIs

| API | Purpose | Cost |
|---|---|---|
| **Nominatim / Geoapify** | Place search and geocoding | Free tier |
| **OSRM** (or OpenRouteService) | Distance and travel time between places | Free |
| **Open-Meteo** | Weather forecast | Free, no key |
| **Resend / Nodemailer** | Email invites (optional) | Free tier |

### DevOps and Tooling

| Tool | Purpose |
|---|---|
| **Docker + Docker Compose** | Run Postgres and Redis locally; containerize the app |
| **GitHub Actions** | CI: lint, test, build |
| **Vitest + Supertest** | Unit and API tests |
| **ESLint** | Linting (frontend now, backend later) |
| **Postman / Thunder Client** | API testing |
| **Render / Railway / Fly.io** | Backend, Postgres, and Redis hosting |
| **Vercel / Netlify** | Frontend hosting |

---

## 6. System Architecture

```
┌──────────────────────────────────────────────┐
│                React Frontend                │
│  Pages · Map · Drag-and-drop · TanStack Query│
└──────────────┬──────────────────┬────────────┘
               │ REST (HTTPS)     │ WebSocket (Socket.IO)
               ▼                  ▼
┌──────────────────────────────────────────────┐
│          Node.js + Express Server            │
│                                              │
│  Auth middleware ──► Routes ──► Services     │
│                         │                    │
│              Socket.IO (room per trip)       │
└───────┬──────────────┬──────────────┬────────┘
        │              │              │
        ▼              ▼              ▼
  ┌──────────┐   ┌──────────┐   ┌─────────────────┐
  │PostgreSQL│   │  Redis   │   │ External APIs   │
  │ (data)   │   │(presence,│   │ LLM, OSRM,      │
  │          │   │ cache,   │   │ Nominatim,      │
  │          │   │ pub/sub) │   │ Open-Meteo      │
  └──────────┘   └──────────┘   └─────────────────┘
```

### How a live update flows (example: a vote)

1. User clicks "upvote" and the frontend sends `POST /api/places/:id/vote`.
2. Server checks the JWT and confirms the user is a member of that trip.
3. Server saves the vote in a transaction (the unique constraint prevents duplicates).
4. Server emits `vote:updated` to the Socket.IO room `trip:{tripId}`.
5. Every connected client in that room updates its UI instantly.

**Rule:** REST handles writes and reads; Socket.IO only *broadcasts* the result. This keeps validation and authorization in one place.

---

## 7. Database Design

### Tables

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | text | |
| email | text | unique |
| password_hash | text | nullable if Google login |
| avatar_url | text | |
| created_at | timestamp | |

**trips**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | text | |
| destination | text | |
| start_date, end_date | date | |
| currency | text | default `INR` |
| owner_id | UUID (FK → users) | |
| voting_deadline | timestamp | nullable |
| created_at | timestamp | |

**trip_members**
| Column | Type | Notes |
|---|---|---|
| trip_id | UUID (FK) | |
| user_id | UUID (FK) | |
| role | enum | `OWNER` / `MEMBER` |
| joined_at | timestamp | |
| | | PK = (trip_id, user_id) |

**invites**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| token | text | unique, random |
| expires_at | timestamp | |
| created_by | UUID (FK) | |

**places**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| added_by | UUID (FK) | |
| name | text | |
| address | text | |
| lat, lng | double | |
| category | enum | food, sight, stay, activity, other |
| notes | text | |
| duration_minutes | int | estimated time to spend |
| is_locked | boolean | winner after voting closes |
| created_at | timestamp | |

**votes**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| place_id | UUID (FK) | |
| user_id | UUID (FK) | |
| value | smallint | `+1` or `-1` |
| | | **UNIQUE (place_id, user_id)** |

**itinerary_days**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| day_number | int | |
| date | date | |
| | | UNIQUE (trip_id, day_number) |

**itinerary_items**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| day_id | UUID (FK) | |
| place_id | UUID (FK) | |
| position | int | order within the day |
| start_time | time | |
| duration_minutes | int | |
| is_locked | boolean | AI must not move it |
| source | enum | `MANUAL` / `AI` |
| notes | text | |
| version | int | for conflict detection |

**expenses**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| paid_by | UUID (FK) | |
| title | text | |
| amount_minor | bigint | **stored in paise/cents (integer)** |
| currency | text | |
| split_type | enum | `EQUAL` / `EXACT` / `PERCENT` |
| idempotency_key | text | unique, prevents double-submits |
| created_at | timestamp | |

**expense_splits**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| expense_id | UUID (FK) | |
| user_id | UUID (FK) | |
| share_minor | bigint | must sum to the expense amount |

**settlements**
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| from_user | UUID (FK) | |
| to_user | UUID (FK) | |
| amount_minor | bigint | |
| settled_at | timestamp | |

**activity_log** *(P1)*
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| trip_id | UUID (FK) | |
| actor_id | UUID (FK) | |
| type | text | e.g. `PLACE_ADDED` |
| payload | jsonb | |
| created_at | timestamp | |

### Relationships at a glance

```
users ──< trip_members >── trips ──< places ──< votes
                            │
                            ├──< itinerary_days ──< itinerary_items >── places
                            ├──< expenses ──< expense_splits
                            └──< settlements
```

### Important constraints
- `UNIQUE (place_id, user_id)` on votes: one vote per person per place
- Expense splits **must sum exactly** to the expense amount (enforced in a transaction)
- Money is always stored as **integers** (minor units), never floats
- Add indexes on `trip_id` for places, expenses, and itinerary tables

---

## 8. API Design

All routes are prefixed with `/api`. Every route except auth and invite preview requires a valid JWT, and every trip route checks that the user is a member.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Log in, receive tokens |
| POST | `/auth/refresh` | Get a new access token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET | `/auth/me` | Current user |

### Trips and Members
| Method | Endpoint | Description |
|---|---|---|
| POST | `/trips` | Create a trip |
| GET | `/trips` | List my trips |
| GET | `/trips/:tripId` | Trip details |
| PATCH | `/trips/:tripId` | Update trip (owner) |
| DELETE | `/trips/:tripId` | Delete trip (owner) |
| POST | `/trips/:tripId/invites` | Create invite link |
| POST | `/invites/:token/join` | Join via invite |
| DELETE | `/trips/:tripId/members/:userId` | Remove member (owner) or leave |

### Places and Votes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips/:tripId/places` | List places with vote totals |
| POST | `/trips/:tripId/places` | Add a place |
| PATCH | `/places/:placeId` | Edit a place |
| DELETE | `/places/:placeId` | Delete a place |
| PUT | `/places/:placeId/vote` | Cast or change a vote |
| DELETE | `/places/:placeId/vote` | Remove my vote |
| GET | `/search/places?q=` | Search places (proxy to geocoding API) |

### Itinerary
| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips/:tripId/itinerary` | Full itinerary |
| POST | `/trips/:tripId/itinerary/days` | Add a day |
| POST | `/itinerary/days/:dayId/items` | Add a stop to a day |
| PATCH | `/itinerary/items/:itemId` | Edit time, duration, or lock |
| PATCH | `/trips/:tripId/itinerary/reorder` | Reorder or move stops |
| DELETE | `/itinerary/items/:itemId` | Remove a stop |
| POST | `/trips/:tripId/itinerary/generate` | Generate with AI |
| POST | `/itinerary/days/:dayId/regenerate` | Regenerate one day |

### Expenses
| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips/:tripId/expenses` | List expenses |
| POST | `/trips/:tripId/expenses` | Add an expense (requires `Idempotency-Key` header) |
| PATCH | `/expenses/:expenseId` | Edit an expense |
| DELETE | `/expenses/:expenseId` | Delete an expense |
| GET | `/trips/:tripId/balances` | Net balance per member |
| GET | `/trips/:tripId/settlements/suggested` | Simplified payment plan |
| POST | `/trips/:tripId/settlements` | Record a settled payment |

### Extras (P1)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips/:tripId/activity` | Activity feed |
| GET | `/trips/:tripId/weather` | Daily forecast |
| POST | `/trips/:tripId/itinerary/optimize-route` | Reorder a day for the shortest route |
| GET | `/public/trips/:shareToken` | Read-only public itinerary |

---

## 9. Real-Time Events (Socket.IO)

### Connection and rooms
- Client connects with its JWT in the handshake.
- Server verifies the token, then `join`s the client to `trip:{tripId}` **only if the user is a member**.
- Every broadcast goes to the trip's room, so users never see another trip's data.

### Server → Client events

| Event | Payload | Triggered when |
|---|---|---|
| `place:added` / `place:updated` / `place:deleted` | place object or id | Places change |
| `vote:updated` | `{ placeId, totals, userVotes }` | Anyone votes |
| `itinerary:updated` | day or item object | Itinerary changes |
| `itinerary:generated` | full itinerary | AI generation finishes |
| `expense:added` / `expense:updated` / `expense:deleted` | expense object | Expenses change |
| `balances:updated` | balances array | After any expense or settlement |
| `member:joined` / `member:left` | user object | Membership changes |
| `presence:update` | list of online users | Someone connects or disconnects |
| `editing:start` / `editing:end` | `{ itemId, user }` | Someone starts or stops editing an item |
| `activity:new` | activity entry | Any logged action |

### Client → Server events
| Event | Purpose |
|---|---|
| `trip:join` | Join a trip room |
| `trip:leave` | Leave a trip room |
| `editing:start` / `editing:end` | Announce an edit lock |

### Reconnection strategy
On reconnect, the client re-joins the room and **refetches the latest state** through REST (via TanStack Query invalidation). This is simpler and safer than replaying missed events.

---

## 10. Key Algorithms and Design Decisions

### 10.1 Expense storage: integers, not floats
Floating-point math causes errors like `0.1 + 0.2 = 0.30000000000000004`. All amounts are stored as integers in the smallest unit (paise or cents) and only formatted for display.

**Splitting remainders:** if ₹100 (10000 paise) is split among 3 people, the shares are 3334, 3333, and 3333. The extra paisa goes to the first people in a fixed order, so the total always matches exactly.

### 10.2 Balances and debt simplification
1. For each member, compute **net balance** = total they paid − total they owe.
   - Positive: they should receive money
   - Negative: they should pay money
2. Split members into **creditors** (positive) and **debtors** (negative).
3. Greedy matching: repeatedly take the largest debtor and largest creditor, settle `min(debt, credit)` between them, and update both balances. Repeat until all balances are zero.

This produces at most **n − 1** payments for n people, instead of a tangled web of many small debts.

**Example:** A owes B ₹500, B owes C ₹500. Simplified result: A pays C ₹500 directly (one payment, not two).

### 10.3 Voting
- A unique constraint on `(place_id, user_id)` makes double-voting impossible at the database level.
- Use `UPSERT` so changing a vote is one atomic operation.
- Score = upvotes − downvotes. Ties are broken by earliest-added.

### 10.4 Idempotency for expenses
The client sends an `Idempotency-Key` (a UUID) with each "add expense" request. The server stores it in a unique column. If the same key arrives again (double-click, retry on a flaky connection), the server returns the original result instead of creating a duplicate.

### 10.5 Conflict handling for itinerary edits
Two options, from simple to stronger:
1. **Edit locks (recommended first):** when a user starts editing an item, broadcast `editing:start`. Others see it as locked until `editing:end` (with an auto-expiring lock in Redis in case the user closes the tab).
2. **Optimistic versioning:** each item has a `version`. An update must send the version it last saw. If the server's version is newer, it rejects the update with `409 Conflict` and the client refetches.

Use locks for the UX and versioning as the safety net.

### 10.6 Authorization everywhere
- Every REST route checks trip membership through middleware.
- Every Socket.IO room join checks membership.
- Owner-only actions (delete trip, remove member) check the role.

---

## 11. AI Itinerary Design

### Principle: code does the math, AI does the judgment
LLMs are unreliable at distances, time arithmetic, and strict constraints. So the work is split:

| Step | Done by | Why |
|---|---|---|
| Group nearby places into the same day (clustering by distance) | **Code** | Precise and repeatable |
| Compute travel time between stops | **Code + routing API** | AI would guess |
| Decide sensible order, meal breaks, and add short tips | **AI** | Needs judgment |
| Check that each day fits in available hours and no place was invented | **Code (validation)** | Never trust raw AI output |

### Inputs
- Places (voted or selected), each with `duration_minutes`
- Number of days
- Daily start and end time
- Pace (relaxed, balanced, packed)
- Locked stops (fixed day and time)
- Optional: budget and interests

### Flow
1. Gather places and constraints.
2. Pre-cluster places by location into N days (for example, with k-means or a simple nearest-neighbor grouping).
3. Compute a travel-time matrix with OSRM.
4. Send the clusters, durations, and constraints to the LLM and ask for **strict JSON**.
5. **Validate** the response with Zod:
   - Every place ID exists in the input
   - No place appears twice
   - Each day's total time fits the daily window
   - Locked stops were not moved
6. If validation fails, retry once with the error message included. If it fails again, fall back to the code-only plan (clusters ordered by nearest neighbor).
7. Save to `itinerary_items` with `source = 'AI'` and broadcast `itinerary:generated`.

### Example output the AI must follow
```json
{
  "days": [
    {
      "dayNumber": 1,
      "items": [
        { "placeId": "uuid-1", "startTime": "09:00", "durationMinutes": 120, "tip": "Go early to avoid crowds" },
        { "placeId": "uuid-2", "startTime": "12:00", "durationMinutes": 60, "tip": "Lunch break nearby" }
      ]
    }
  ]
}
```

### Reliability checklist
- Timeout on the LLM call (for example, 30 seconds)
- One retry with the validation error
- A deterministic fallback so the feature never fully fails
- Manual mode always works even if the AI is down

---

## 12. Security

| Area | Measure |
|---|---|
| Passwords | Hashed with bcrypt, never stored or logged in plain text |
| Auth | Short-lived JWT access tokens, refresh tokens stored hashed and rotated |
| Input | All request bodies validated with Zod |
| Authorization | Membership and role checks on every REST route and socket join |
| Invites | Random unguessable tokens with expiry |
| Rate limiting | Per-IP limits on auth routes, per-user limits on AI generation |
| Headers and CORS | Helmet and a strict CORS allowlist |
| Secrets | Environment variables only, never committed |
| SQL injection | Prevented by using the ORM and parameterized queries |
| XSS | React escaping, and sanitize any user text rendered as HTML |
| API keys | Third-party and LLM keys stay server-side; the frontend never sees them |

---

## 13. Folder Structure

```
tripzy/
├── Frontend/                    # React app (JavaScript + JSX)
│   ├── src/
│   │   ├── api/                 # API functions + TanStack Query hooks
│   │   ├── components/          # Reusable UI (Map, PlaceCard, VoteButton...)
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── trips/
│   │   │   ├── places/
│   │   │   ├── itinerary/
│   │   │   └── expenses/
│   │   ├── hooks/               # useSocket, usePresence...
│   │   ├── pages/
│   │   ├── store/               # Zustand stores
│   │   └── main.jsx
│   └── package.json
│
├── Backend/                     # Express API (JavaScript, ES modules)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── prisma.config.js         # Prisma 7 config (schema path, DATABASE_URL)
│   ├── generated/prisma/        # Generated Prisma client (gitignored)
│   ├── src/
│   │   ├── config/              # env, db, redis
│   │   ├── middleware/          # auth, membership, validate, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/            # routes, controller, service
│   │   │   ├── trips/
│   │   │   ├── places/
│   │   │   ├── votes/
│   │   │   ├── itinerary/
│   │   │   ├── expenses/
│   │   │   └── ai/              # prompt, clustering, validation
│   │   ├── sockets/             # socket setup, handlers, presence
│   │   ├── utils/               # money helpers, settlement algorithm
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   └── package.json
│
├── docker-compose.yml           # Postgres + Redis for local dev
├── .github/workflows/ci.yml
└── README.md
```

Each backend module follows the same pattern: **routes → controller → service → database**. Business logic lives in services so it can be tested without HTTP.

---

## 14. Environment Variables

**Backend/.env**
```
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://tripzy:tripzy@localhost:5432/tripzy
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too

LLM_PROVIDER=gemini
LLM_API_KEY=your-key

GEOCODING_BASE_URL=https://nominatim.openstreetmap.org
OSRM_BASE_URL=https://router.project-osrm.org

EMAIL_API_KEY=optional
```

**Frontend/.env**
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 15. Local Setup

```bash
# 1. Clone
git clone https://github.com/<your-username>/tripzy.git
cd tripzy

# 2. Start Postgres and Redis
docker compose up -d

# 3. Backend
cd Backend
cp .env.example .env        # fill in values
npm install
npx prisma migrate dev     # creates tables
npx prisma generate        # generates the client into generated/prisma
npm run dev

# 4. Frontend (new terminal)
cd ../Frontend
cp .env.example .env
npm install
npm run dev
```

The app runs at `http://localhost:5173`, and the API at `http://localhost:5000`.

---

## 16. Testing Strategy

Test the logic that would hurt most if wrong. Don't chase 100% coverage.

| Area | Type | What to verify |
|---|---|---|
| Money helpers | Unit | Equal, exact, and percent splits always sum to the total; remainders handled |
| Settlement algorithm | Unit | Balances reach zero; payment count is at most n − 1 |
| Voting | Integration | One vote per user; changing a vote updates totals |
| Auth and membership | Integration | Non-members get 403 on trip routes |
| Idempotency | Integration | Same key twice creates one expense |
| AI validation | Unit | Rejects invented place IDs, duplicates, and overfull days |
| Socket auth | Integration | Non-members cannot join a trip room |

**Tools:** Vitest or Jest, Supertest for API tests, a separate test database.

---

## 17. Deployment

| Piece | Suggested host |
|---|---|
| Frontend | Vercel or Netlify |
| Backend (Express + Socket.IO) | Render, Railway, or Fly.io (choose one that supports long-lived WebSocket connections) |
| PostgreSQL | Managed Postgres on the same platform, or Neon / Supabase |
| Redis | Upstash or the platform's managed Redis |

**Checklist**
- Use environment variables for all secrets
- Run migrations on deploy
- Set the CORS allowlist to the production frontend URL
- Add a `/health` endpoint
- Set up GitHub Actions to lint, test, and build on every push
- **Deploy a basic version early (around Day 15)** so deployment surprises don't appear at the end

---

## 18. Build Roadmap (50 Days)

The trip planner takes roughly the first 28 days; the remaining time goes to your second (developer-focused) project, extras, polish, and docs.

| Days | Focus | Output |
|---|---|---|
| 1-4 | Setup and learning: repo, Docker, Prisma schema, Socket.IO and Redis basics | Project skeleton running |
| 5-8 | Auth, trips, members, invite links | Users can sign up, create trips, and invite friends |
| 9-12 | Places board and map | Search, add, and view places on a map |
| 13-15 | Socket.IO rooms and live updates, then voting | Live voting; **first deploy** |
| 16-19 | Expenses, splits, balances, settlement algorithm | Full expense flow with tests |
| 20-24 | Manual itinerary with drag-and-drop | Users can build day-by-day plans |
| 25-28 | AI itinerary generation, validation, fallback, lock and regenerate | Hybrid itinerary mode |
| 29-40 | *Second project* (PR review bot or LLM gateway) | Deployed developer project |
| 41-46 | Stand-out extras (presence, route optimization, activity feed), bug fixes | Polished planner |
| 47-50 | Tests, README, architecture diagram, demo video, real users | Resume-ready |

**Weekly rule:** if a feature takes twice its estimate, cut it or simplify it.

---

## 19. Interview Talking Points

Be ready to explain these clearly. They are the "hard parts" of this project.

1. **Real-time sync:** Why Socket.IO? Why rooms per trip? How do you recover after a disconnect? (Refetch state on reconnect.)
2. **Concurrent edits:** What if two people move the same itinerary item? (Edit locks plus optimistic versioning.)
3. **Expense math:** Why integers instead of floats? How does debt simplification work, and why is it at most n − 1 payments?
4. **Idempotency:** How do you stop a double-click from creating two expenses?
5. **Authorization:** How do you make sure users only see trips they belong to, including over WebSockets?
6. **AI reliability:** What if the model returns invalid JSON, invents a place, or times out? (Validation, retry, deterministic fallback.)
7. **Design choice:** Why let code do clustering and travel times while the AI handles ordering and tips?
8. **Tradeoffs:** REST for writes and sockets for broadcasts; Postgres over a NoSQL database; Leaflet over Google Maps (cost and simplicity).
9. **Scaling:** How would it handle many servers? (Redis adapter for Socket.IO, stateless API, indexes on `trip_id`.)

---

## 20. Future Scope

- Offline-first PWA with background sync
- Multi-currency expenses with live exchange rates
- Push notifications and email reminders
- Comments, reactions, and polls
- PDF export and calendar (ICS) export
- Natural-language itinerary edits ("make Day 2 cheaper")
- Booking links for hotels and activities
- Plug in your own LLM Gateway as the AI layer
- Native mobile app using React Native

---

## License

MIT
