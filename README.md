# Folio


## Google sign-in setup

Google sign-in is optional. Email/password signup and guest access continue to work without Google credentials.

1. In Google Cloud Console, create or select a project and configure the OAuth consent screen.
2. Create an OAuth 2.0 Client ID of type **Web application**.
3. Add your local and production app origins under **Authorized JavaScript origins** (for example, `http://localhost:3000`).
4. Add the exact callback URL under **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://YOUR_DOMAIN/api/auth/google/callback`
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the deployment environment. `GOOGLE_REDIRECT_URI` must exactly match the registered callback URL.
6. Install dependencies with `npm install`.
7. Apply the database change to the existing PostgreSQL database by running the SQL in `drizzle/0001_add_google_auth.sql` (or apply the equivalent migration through your database migration workflow).
8. Run `npm run typecheck` and `npm run build`.

The OAuth callback validates the anti-CSRF state value and Google's signed ID token, requires a verified Google email, and creates or links the matching account. Existing accounts keep their current password and workspace data. A successful Google sign-in receives the same server-side session cookie used by the existing authentication system.
