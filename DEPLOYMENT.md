# Deploying Tripzy for free

This guide puts Tripzy online using only free plans. Follow the steps in order: some steps need a value (a URL or key) that an earlier step gives you.

| Piece | Host (free plan) | Why this one |
|---|---|---|
| Database (PostgreSQL) | **Neon** | Free forever, no expiry (Render's free database is deleted after 30 days) |
| Backend (Express + Socket.IO) | **Render** | Runs long-lived WebSocket connections for the Live updates |
| Frontend (React) | **Vercel** | Fast static hosting; also forwards `/api` to the backend so logins keep working in Safari |
| Invite emails | **Brevo** | Free hosts block normal email (SMTP), so emails go through Brevo's web API instead |

Already configured in the repo: `render.yaml` (backend settings), `Frontend/vercel.json` (frontend routing) and the Brevo email support.

You'll need about 45 minutes and a GitHub account that has the Tripzy repo.

---

## Step 0. Push the latest code

```bash
git add -A
git commit -m "Deployment config"
git push
```

Render and Vercel deploy from GitHub, so they only see what you've pushed.

---

## Step 1. Database on Neon

1. Sign up at **https://neon.tech** (use "Continue with GitHub").
2. Create a project:
   - **Name:** `tripzy`
   - **Postgres version:** the default (16 or newer)
   - **Region:** the one closest to your users. From India, pick **AWS Asia Pacific (Singapore)**.
3. On the project dashboard, click **Connect**. Turn **off** "Connection pooling", so you get the *direct* connection (database migrations need it).
4. Copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:xxxxxxxx@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   This is your **`DATABASE_URL`**. Keep it secret: it gives full access to your data.

> Don't run `npm run db:seed` against this database. It creates a demo account whose password is published in the README.

---

## Step 2. Email on Brevo

1. Sign up at **https://www.brevo.com** (free plan: 300 emails a day).
2. Verify the address emails will come from: **Settings → Senders, Domains & Dedicated IPs → Senders → Add a sender**. Use your Gmail address, then click the confirmation link Brevo emails you.
3. Create an API key: **Settings → SMTP & API → API keys → Generate a new API key**. Name it `tripzy`. Copy it now; Brevo shows it only once. This is your **`BREVO_API_KEY`**.

Your **`MAIL_FROM`** will be `Tripzy <your-verified-gmail@gmail.com>`.

> Because you don't own the `gmail.com` domain, Brevo may show the sender as an `@brevosend.com` address. Emails are still delivered. If they land in spam, ask friends to mark them "Not spam". Buying your own domain later and verifying it in Brevo removes this.

---

## Step 3. Backend on Render

1. Sign up at **https://render.com** with GitHub.
2. Click **New → Blueprint**, pick your Tripzy repository and click **Connect**. Render reads `render.yaml` and proposes a web service called **`tripzy-api`**.
3. Render asks for the values marked secret. Fill them in:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `CLIENT_URL` | for now `https://tripzy.vercel.app` (you'll correct it in Step 5) |
   | `APP_URL` | same as `CLIENT_URL` |
   | `MAIL_FROM` | `Tripzy <your-verified-gmail@gmail.com>` |
   | `BREVO_API_KEY` | from Step 2 |
   | `GOOGLE_CLIENT_ID` | the same value as in your local `Backend/.env` |
   | `GEMINI_API_KEY` | the same value as in your local `Backend/.env` |
   | `GEOCODER_EMAIL` | your email (OpenStreetMap asks for a contact address; optional) |

   `JWT_ACCESS_SECRET` is generated automatically, so leave it. Don't copy your local one.

   Don't add `SMTP_URL` on Render. SMTP is blocked on the free plan; Brevo replaces it.

4. Click **Apply**. The first build takes 3–5 minutes. It installs packages, sets up the database tables in Neon and starts the server.
5. When the service shows **Live**, note its URL at the top, e.g. **`https://tripzy-api.onrender.com`**.
6. Open `https://tripzy-api.onrender.com/health` in your browser. You should see:
   ```json
   {"status":"ok","database":"up"}
   ```

If the build fails, open **Logs**: the last red lines say why. Common causes are listed in the Troubleshooting section below.

---

## Step 4. Frontend on Vercel

1. **Point the frontend at your backend.** In `Frontend/vercel.json`, replace `YOUR-RENDER-SERVICE` with your service name from Step 3:
   ```json
   { "source": "/api/:path*", "destination": "https://tripzy-api.onrender.com/api/:path*" },
   ```
   Commit and push:
   ```bash
   git add Frontend/vercel.json
   git commit -m "Point frontend at the deployed API"
   git push
   ```
2. Sign up at **https://vercel.com** with GitHub.
3. Click **Add New → Project** and import the Tripzy repository.
4. Configure the project:
   - **Root Directory:** click **Edit** and choose **`Frontend`**
   - **Framework Preset:** Vite (detected automatically)
   - **Environment Variables:**

     | Key | Value |
     |---|---|
     | `VITE_API_URL` | `/api` |
     | `VITE_SOCKET_URL` | `https://tripzy-api.onrender.com` (your Render URL, no trailing slash) |

5. Click **Deploy**. After about a minute you get a URL like **`https://tripzy-abc123.vercel.app`**.
   - **Optional:** in **Settings → Domains** you can rename it, e.g. to `tripzy-sanskriti.vercel.app`, if that name is free.

> `VITE_API_URL` must stay `/api`. Requests then go through Vercel's proxy, so the login cookie counts as first-party and Safari doesn't log people out.

---

## Step 5. Connect everything

1. **Tell the backend the frontend's real address.** In Render, open **tripzy-api → Environment**:
   - set `CLIENT_URL` to your exact Vercel URL, e.g. `https://tripzy-abc123.vercel.app` (no trailing slash)
   - set `APP_URL` to the same value
   - **Save changes**. Render redeploys automatically, which takes a couple of minutes.
2. **Allow Google sign-in on the new address.** In **Google Cloud Console → APIs & Services → Credentials**, open your OAuth client. Under **Authorized JavaScript origins**, add your Vercel URL and save. It can take a few minutes to start working.

---

## Step 6. Check that everything works

Open your Vercel URL and go through this list:

- [ ] **Health through the site.** Open `https://<your-vercel-url>/api/health`. It should show `"status":"ok"` and a **`yourIp`** value. Compare that with your real IP (search "what is my IP"). They should match.
  - If they don't match, every visitor shares one rate limit. Change `TRUST_PROXY` in Render to `3`, save, and check again (or `1` if it shows a private-looking address).
- [ ] **Sign up** with email and password, then reload the page. You should still be logged in.
- [ ] **Continue with Google** works.
- [ ] **Create a trip**, add a place with **Search the map** (press Enter), and check it appears on the map in the right spot.
- [ ] **Open the trip in a second browser** (or a private window) logged in as another account, after inviting it. The **Live** badge shows, and changes appear on both screens.
- [ ] **The invite email arrives.** Check spam too.
- [ ] **Itinerary → Plan with AI** shows "Planned by Gemini".
- [ ] **Open a link directly**, e.g. `https://<your-vercel-url>/trips`, and reload. You should get the page, not a 404.

---

## How the free plans behave

- **The backend sleeps after 15 minutes without visitors.** The next visit wakes it, which takes about 30–60 seconds, and the Live badge shows "Reconnecting…" until it's back.
  - **Optional:** to keep it awake, create a free job at **https://cron-job.org** that opens `https://tripzy-api.onrender.com/health` every 10 minutes. One always-on service fits within Render's 750 free hours a month.
- **Neon:** 0.5 GB of storage. The database pauses when idle and wakes in about a second.
- **Brevo:** 300 emails a day.
- **Gemini:** free-tier limits apply. When reached, the planner automatically uses the route-based planner instead.
- **OpenStreetMap search:** shared public service, limited to 1 search per second for the whole server. Fine for a small group.

---

## Updating the live site

Push to `main`:

```bash
git push
```

- **Vercel** rebuilds the frontend automatically.
- **Render** rebuilds the backend and applies any new database migrations (`npm run db:deploy` is part of the build).

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Render build fails at `prisma generate` or `migrate deploy` | Check the build command is `npm ci --include=dev && npm run db:deploy` (from `render.yaml`) and that `DATABASE_URL` is the **direct** Neon string ending in `?sslmode=require`. |
| `/health` says `"database":"down"` | `DATABASE_URL` is wrong, or the Neon project was deleted or paused. Re-copy it from Neon → Connect. |
| Browser console shows a CORS error | `CLIENT_URL` in Render isn't exactly your Vercel URL (check `https`, no trailing slash, same spelling). |
| Logged out after every reload | `VITE_API_URL` isn't `/api`, or `Frontend/vercel.json` still says `YOUR-RENDER-SERVICE`. Fix it and redeploy. |
| Reloading `/trips/...` gives a 404 | Vercel's **Root Directory** isn't `Frontend`, so `vercel.json` isn't used. |
| Live badge stays "Reconnecting…" | `VITE_SOCKET_URL` is wrong, or the backend is still waking up (wait a minute). |
| "Continue with Google" missing or `origin_mismatch` | `GOOGLE_CLIENT_ID` isn't set on Render, or the Vercel URL isn't in Authorized JavaScript origins. |
| Invites show a link but no email arrives | Check `BREVO_API_KEY`, that the `MAIL_FROM` address is a verified sender in Brevo, and the Render logs for "Failed to send email". |
| AI planner always says "route-based plan" | `GEMINI_API_KEY` isn't set on Render, or the daily free quota was reached. |

---

## Security checklist

- Secrets live only in Render's and Vercel's settings, never in git. `.env` is git-ignored.
- Production uses its own `JWT_ACCESS_SECRET` (generated by Render), not your local one.
- Never run the seed script on the production database.
- If a key ever leaks (e.g. pasted somewhere public), regenerate it at its provider and update it in Render.
