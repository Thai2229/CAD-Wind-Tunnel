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

1. The browser asks `POST /api/models` with the file name, extension, size and unit and the JWT. It never sends a storage key.
2. The function verifies the JWT (see the requirements below), validates the body, enforces the quotas, inserts a `pending` row and returns a presigned upload for the key `users/<sub>/<model id><extension>`. The server builds that key. The file name the user typed is stored in `models.name` only and never appears in a key, a path or a header.
3. The browser uploads straight to S3.
4. The browser calls `POST /api/models/<id>/complete` with no body. The function loads the row for this user in the `pending` state, checks the object in S3 against the row (see below), and marks it `ready` in one conditional update.

Pending rows older than a day with no upload are cleaned up by a scheduled job.

Opening a saved model: `GET /api/models` lists the user's rows. `GET /api/models/<id>/file` checks ownership and returns a short-lived presigned download URL. The browser fetches it and loads the file through the same loader as a dropped file, so the size, vertex and URL protections still apply.

Deleting a model removes the S3 object and the row. Deleting an account removes all of a user's rows and objects.

## Changes to the site's security settings

- `connect-src` in the page policy must list the Neon Auth address and the S3 bucket address, and nothing broader. This is the one place the "never uploaded" protection is deliberately loosened, and only for signed-in saves.
- The sign-in address is public configuration, so it is a `VITE_` variable. The database URL and AWS settings are server-only and never get that prefix.
- JWT verification happens only in the API functions. The browser's copy of the token is never trusted for access.

## Open decisions

- Do saved models expire? A lifecycle rule on the bucket is cheap and keeps storage cost bounded. Suggested: keep them until the user deletes them.
- Sharing a model by link is out of scope for the first version and needs its own security review.

The per-user limits are not optional. They are the abuse and cost control for S3, so they are enforced, not just displayed: 20 models, 500 MB in total and at most 5 pending uploads per user at launch. The numbers can change, but the limits must exist.

## Requirements to carry into the build

A security review of this design listed what the build must do. The schema already covers the database parts.

### Verifying the sign-in token

- Verify every token in the API with a maintained library such as `jose`. Never decode a token without verifying it.
- Take the key set address from server configuration only. Ignore `jku`, `x5u` and `jwk` headers inside the token.
- Pin the signing algorithm to the one Neon publishes, and reject `none` and the HMAC family.
- Pick the key by `kid`. Cache the key set with an expiry. On an unknown `kid`, refetch at most once in a short window, so random key ids cannot force a fetch on every request.
- Check `iss` against the exact issuer for this environment's Neon branch, so a staging token fails in production. Check `aud` if Neon sets one. Check `exp`, `nbf` and `iat` with at most 60 seconds of clock skew, and require a non-empty `sub`.
- Accept the token only in the `Authorization: Bearer` header. Never put it in a URL and never log it.
- If the key set cannot be fetched, fail closed, or serve from cache for a short bounded time.
- Return a generic 401 for any failure.
- Confirm in Neon's docs how logout and revocation work. A token stays valid until `exp`, so keep that short.

### Ownership on every route

- `user_id` always comes from the verified token and the row id from the path, never from the body. Validate the id as a UUID before querying.
- Apply one shared ownership helper to every route: complete, file download, delete and every runs route. `runs` has no `user_id`, so its queries join `models` and filter on `models.user_id`.
- Return 404, not 403, for a row that is missing or belongs to someone else.
- Write a test that user B gets 404 on every one of user A's routes.

### Uploads

- Presigned POST with a policy is preferred: fixed `key`, fixed `Content-Type`, and `content-length-range` set to the declared size. If a presigned PUT is used, sign the exact `Content-Length` and `Content-Type`, because a PUT cannot enforce a size range any other way.
- Expiry of 60 to 300 seconds, one upload URL per pending row, and never a new one for a row that is already `ready`. Use `If-None-Match: *` on the write so an existing object is never overwritten.
- At `complete`, trust nothing from the client. Run a HEAD on the server-derived key and compare the length and content type to the row. Fetch the first few hundred bytes and sniff them: `glTF` for GLB, `ply` for PLY, `ISO-10303-21` for STEP. If it fails, mark the row `failed` and delete the object.
- Update with `where id = $1 and user_id = $2 and status = 'pending'` and treat zero rows as an error. `ready` and `failed` are final.
- Check the quotas in the same transaction as the insert, serialized per user with `pg_advisory_xact_lock(hashtext(user_id))`. Without that, two parallel requests can both pass the count check. Count pending rows too.
- Validate the body against a strict schema that rejects unknown fields. Take the extension and unit from the allowlists. Strip control characters, path separators and right-to-left overrides from the name, cap its length, and always escape it when shown.

### Bucket and downloads

- Block all public access, disable ACLs, turn on encryption, and deny requests that are not over TLS.
- A lifecycle rule that aborts incomplete multipart uploads. A second rule can expire anything left unfinished.
- The IAM role gets `PutObject`, `GetObject`, `DeleteObject` and `ListBucket` on `users/*` in its own environment's bucket and nothing else. Trust Vercel's OIDC token only for the exact project and environment.
- CORS allows only the exact site origins, with separate lists for staging and production. No `*`. Previews use their own bucket or none.
- Download links last 60 seconds and are issued with `response-content-disposition=attachment`. The file is only ever parsed by the browser's model loader, never rendered by a server.
- Turn on access logging or CloudTrail data events for the bucket.

### Account deletion and cleanup

- Deletion goes in order: delete the objects under `users/<sub>/` (paginated), then the rows, then the auth user. It must be safe to retry, so a crash midway leaves a record that a job finishes. Ask for a recent sign-in first.
- Because `user_id` has no foreign key, a user removed straight from the Neon console leaves rows behind. A scheduled job reconciles `models.user_id` against `neon_auth."user"`.
- A cleanup job removes pending rows older than a day together with their objects, handles `failed` rows, and finds objects that have no row. It runs from Vercel Cron, takes a lock so two runs never overlap, and its endpoint requires a secret compared in constant time.

### Page, API and secrets

- The page policy's `connect-src` lists the exact Neon Auth address and the exact bucket host for that environment, not a wildcard. Each environment gets its own policy, so staging never allows a production address.
- API functions are same-origin. Send no `Access-Control-Allow-Origin: *`. Authentication uses the bearer header, not cookies, so cross-site request forgery does not apply. If cookies are ever added, add protection first.
- Add per-user and per-IP rate limits on creating uploads, completing them and downloading, backed by a shared store since serverless memory is not shared. Return 429, and cap request body size.
- Send `Cache-Control: no-store` on authenticated responses, especially those carrying presigned URLs.
- Log the opaque user id, route, status and a request id. Never log tokens, presigned URLs, emails or file names. Return generic database errors to clients. Say in the README what personal data exists (the email and name that Google gives Neon Auth, plus file names) and how long logs are kept.
- Scope Vercel variables per environment. The production database URL and AWS role are available to Production only, marked sensitive, and never to Preview. Nothing secret gets a `VITE_` prefix. Use a dedicated database role for the API with table-level grants, not the owner role.
- Run `npm audit` and a secret scanner such as gitleaks in CI, and pin the versions of `jose`, the AWS SDK and the Neon packages once chosen.

### Google sign-in

- Production must use our own Google OAuth client. Shared credentials are for development only, so using them in production is a release blocker, not a todo.
- Register one exact redirect URI per Neon branch, with no wildcards and no preview URLs. Ask only for the `openid email profile` scopes.
- Confirm in Neon's docs that state and PKCE are on, and let the library handle them. Set the trusted origins in the Auth settings to the exact site origins. If email and password sign-in is not wanted, turn it off.

## What is needed from you

1. A Neon project with Neon Auth turned on for the `production` and `staging` branches, and the sign-in address Neon shows for each.
2. A Google Cloud OAuth client for production, with the redirect URIs from step 1.
3. The AWS account, then the two buckets and IAM roles described in `DEPLOYMENT.md`.

None of these values go into the chat. The `.env.example` file lists the variable names. Set the real values in the Vercel project settings, scoped to Preview, Staging and Production.

## Check against the current Neon docs before building

Neon renamed and rebuilt this product, and the package names in search results disagree (`@neondatabase/auth` and `@neondatabase/neon-js` both appear). Before writing client code, read the current React quick start at neon.com/docs/auth/quick-start/react and the Google guide at neon.com/docs/auth/guides/setup-oauth, and use whichever package and variable names they give. The older Stack Auth version used a `users_sync` table and a different key endpoint, so do not mix its examples in.
