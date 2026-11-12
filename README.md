# Folio

Folio is a calm, collaborative workspace for tasks, projects, pages, calendar planning, team activity, and Google Drive connections.

## What is included

- **Authentication**: Google OAuth, email/password, and guest (anonymous) accounts with server-side sessions
- Workspace dashboard with tasks, projects, pages, calendar, team members, activity, and Studio (events, library, goals, decisions, rituals, focus sessions)
- Profile, Connectors, and Workspace Settings views
- Optional Google Drive connector with storage quota metrics (no file sync)

## Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` and set:

```env
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/connectors/google/callback
DRIVE_TOKEN_ENCRYPTION_KEY=
```

`DRIVE_TOKEN_ENCRYPTION_KEY` is a private random value. Never commit it or share it publicly.

## Database migrations

Run these SQL migrations against the configured PostgreSQL database:

1. `drizzle/0001_add_google_auth.sql`
2. `drizzle/0002_drive_connections.sql`
3. `drizzle/0003_studio.sql`

The Drive connector stores an encrypted refresh token and account metadata. Folio does not read or sync Drive files.

## Google OAuth setup

Create a Google OAuth 2.0 Web application client and add the exact origins and callback URLs:

- JavaScript origin: `http://localhost:3000`
- JavaScript origin: your production domain
- Sign-in callback: `http://localhost:3000/api/auth/google/callback`
- Drive callback: `http://localhost:3000/api/connectors/google/callback`

For production, replace local URLs with the deployed domain. Enable the Google Drive API in the same Google Cloud project. During OAuth testing, add the Gmail under **Google Auth Platform → Audience → Test users**.

## Deployment

Push the `main` branch to the connected GitHub repository. Vercel builds and deploys automatically. Add all environment variables to the Vercel Production environment, then redeploy after changing them.
