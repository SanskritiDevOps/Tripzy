# Deploying Tripzy (free)

| Part | Host | Config in repo |
|---|---|---|
| Database | [Neon](https://neon.tech) (PostgreSQL) | — |
| API | [Render](https://render.com) | `render.yaml` |
| Web app + mail relay | [Vercel](https://vercel.com) | `Frontend/vercel.json`, `Frontend/api/mail-relay.js` |

Render's free plan blocks email ports, so the API sends invite emails through a small Vercel Function that uses Gmail.

## Steps (in this order)

1. **Neon:** create a project (Singapore region, to match `render.yaml`) → **Connect** → turn **off** connection pooling → copy the connection string.
2. **Secrets:**
   - Create a Gmail **app password** (Google Account → Security → 2-Step Verification → App passwords).
   - Generate a relay secret: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`
3. **Render:** New → **Blueprint** → choose this repo → fill in the settings below → Apply. Check that `https://<api>.onrender.com/health` shows `"database":"up"`.
4. **Vercel:**
   - Put your Render URL into `Frontend/vercel.json` and push.
   - New Project → **Root Directory `Frontend`** → add the settings below → Deploy.
5. **Connect them:**
   - In Render, set `CLIENT_URL`, `APP_URL` and `MAIL_RELAY_URL` to your Vercel address.
   - Add the Vercel address to your Google OAuth client's **Authorized JavaScript origins**.

## Settings

**Render (API)**

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (direct, ends with `?sslmode=require`) |
| `CLIENT_URL`, `APP_URL` | `https://<your-site>.vercel.app` (no trailing slash) |
| `MAIL_FROM` | `Tripzy <you@gmail.com>` |
| `MAIL_RELAY_URL` | `https://<your-site>.vercel.app/api/mail-relay` |
| `MAIL_RELAY_SECRET` | the relay secret (same value as on Vercel) |
| `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY` | optional: Google sign-in and AI planning |
| `GEOCODER_EMAIL` | optional: contact email for OpenStreetMap |

`JWT_ACCESS_SECRET`, `NODE_ENV` and `TRUST_PROXY` come from `render.yaml`. Change them in `render.yaml`, not only in the dashboard, because Blueprint syncs overwrite dashboard edits.

**Vercel (web app)**

| Key | Value |
|---|---|
| `VITE_API_URL` | `/api` |
| `VITE_SOCKET_URL` | `https://<api>.onrender.com` |
| `SMTP_URL` | `smtps://you%40gmail.com:<app-password>@smtp.gmail.com:465` |
| `MAIL_FROM` | `Tripzy <you@gmail.com>` |
| `MAIL_RELAY_SECRET` | the same relay secret as on Render |

After changing a Vercel setting, **redeploy**: `VITE_` values are built into the app.

## Check it works

- `https://<your-site>/api/health` shows `"status":"ok"`, and `yourIp` matches your real IP. If it doesn't, adjust `TRUST_PROXY` in `render.yaml`.
- Sign up, reload, and you're still logged in. Google sign-in works.
- Two accounts on one trip see each other's changes live.
- An invite to your own email arrives (check Spam the first time).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Render build fails | `DATABASE_URL` is wrong: it should be the direct (non-`-pooler`) string, with no quotes or spaces |
| **502** or a slow first load | The free API was asleep (~30–60 s to wake). The app retries automatically. To avoid it, ping `/health` every 10 minutes with [cron-job.org](https://cron-job.org). |
| CORS error | `CLIENT_URL` isn't exactly your Vercel address |
| Logged out on every reload | `VITE_API_URL` isn't `/api`, or `vercel.json` points to the wrong API |
| Live badge stuck on "Reconnecting" | `VITE_SOCKET_URL` is wrong, or the API is still waking up |
| Google `origin_mismatch` | The Vercel address is missing from Authorized JavaScript origins |
| Invite says "copy link" instead of "emailed" | Render log "Mail relay responded…": **401** means the secrets differ, **503** means the Vercel settings are missing (redeploy), **502** means Gmail refused (check `SMTP_URL`) |
| AI always gives the "route-based plan" | `GEMINI_API_KEY` is missing, or Gemini is overloaded or over its free quota (it recovers on its own) |

**Updating:** `git push` to `main` redeploys both sides, and database migrations run automatically.

**Never** commit real keys, and never run `npm run db:seed` on the production database.
