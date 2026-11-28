# Accounts and saved models

This is the design for letting people sign in, save models and reopen past runs. Nothing here is built yet beyond the database schema in `db/migrations/0001_models_and_runs.sql`. It builds on the S3 plan in [DEPLOYMENT.md](DEPLOYMENT.md).

## What stays the same

The tunnel works without an account. Dropping a file, viewing the flow and reading the numbers never needs a sign-in and never uploads anything. Signing in only adds a Save button and a "my models" list. That keeps the free, no-friction first visit and keeps the privacy claim in the README true for anyone who does not sign in.

## Pieces

- Neon Postgres holds users and our own tables.
- Neon Auth handles sign-in, including Google. It is managed Better Auth that keeps its users, sessions and settings in a `neon_auth` schema inside the same database. After sign-in the browser holds a JWT whose `sub` claim is the user's id.
- Amazon S3 holds the model files. The AWS account does not exist yet, so that part waits.
- A few Vercel functions under `api/` sit between the browser and the database and bucket. The site stays static everywhere else.

## Neon branches match our environments

Neon gives every database branch its own copy of the auth data and its own sign-in address. Sessions and tokens do not cross branches. That fits the Git flow in `DEPLOYMENT.md` directly:

- Neon branch `production`, used by the Vercel Production environment (the `prod` Git branch).
- Neon branch `staging`, used by the `staging` Git branch.
- Short-lived Neon branches for previews or for trying a migration, deleted afterwards.

Each Neon branch needs its own Google redirect address registered, so the three sign-in addresses are three separate entries in the Google console.

## Sign-in with Google

Neon provides shared Google credentials so sign-in works with no Google setup. That is for trying things only. Before real users, create our own OAuth client in the Google Cloud console, add one redirect URI per Neon branch that Neon shows, and paste the client id and secret into the Neon Console under the branch's Auth settings. The secret lives only in Neon, never in this repo or in Vercel.

## Tables

`models` has one row per saved file: owner, name, extension, size, unit, the S3 key and a status of `pending`, `ready` or `failed`. `runs` holds saved test conditions (wind speed, yaw, Cd) for a model and is deleted with it. `user_id` is text, not a foreign key, so the migration runs on a branch where Neon Auth is not on yet. The API removes a user's rows itself when an account is deleted.

Row level security through Neon's Data API is possible later. For now the API checks ownership on every query (`where user_id = <sub from the verified token>`), which is simpler to test.

## Flows

Saving a model:

1. The browser asks `POST /api/models` with the file name, size and unit and the JWT.
2. The function verifies the JWT against Neon's published public keys, checks the extension and the size caps (50 MB, 20 MB for STEP and IGES), inserts a `pending` row and returns a presigned S3 upload URL for `users/<user id>/<model id>/<file name>`.
3. The browser uploads straight to S3.
4. The browser calls `POST /api/models/<id>/complete`. The function checks the object exists with the expected size, then marks the row `ready`.

Pending rows older than a day with no upload are cleaned up by a scheduled job.

Opening a saved model: `GET /api/models` lists the user's rows. `GET /api/models/<id>/file` checks ownership and returns a short-lived presigned download URL. The browser fetches it and loads the file through the same loader as a dropped file, so the size, vertex and URL protections still apply.

Deleting a model removes the S3 object and the row. Deleting an account removes all of a user's rows and objects.

## Changes to the site's security settings

- `connect-src` in the page policy must list the Neon Auth address and the S3 bucket address, and nothing broader. This is the one place the "never uploaded" protection is deliberately loosened, and only for signed-in saves.
- The sign-in address is public configuration, so it is a `VITE_` variable. The database URL and AWS settings are server-only and never get that prefix.
- JWT verification happens only in the API functions. The browser's copy of the token is never trusted for access.

## Open decisions

- Do saved models expire? A lifecycle rule on the bucket is cheap and keeps storage cost bounded. Suggested: keep them until the user deletes them, with a per-user cap on count and total size.
- Per-user limits: suggested 20 models and 500 MB each at launch.
- Sharing a model by link is out of scope for the first version.

## What is needed from you

1. A Neon project with Neon Auth turned on for the `production` and `staging` branches, and the sign-in address Neon shows for each.
2. A Google Cloud OAuth client for production, with the redirect URIs from step 1.
3. The AWS account, then the two buckets and IAM roles described in `DEPLOYMENT.md`.

None of these values go into the chat. The `.env.example` file lists the variable names. Set the real values in the Vercel project settings, scoped to Preview, Staging and Production.

## Check against the current Neon docs before building

Neon renamed and rebuilt this product, and the package names in search results disagree (`@neondatabase/auth` and `@neondatabase/neon-js` both appear). Before writing client code, read the current React quick start at neon.com/docs/auth/quick-start/react and the Google guide at neon.com/docs/auth/guides/setup-oauth, and use whichever package and variable names they give. The older Stack Auth version used a `users_sync` table and a different key endpoint, so do not mix its examples in.
