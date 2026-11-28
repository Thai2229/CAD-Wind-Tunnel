-- Saved models and test runs.
--
-- user_id holds the Neon Auth user id (the `sub` claim of the sign-in token, which
-- is neon_auth."user".id). It is plain text on purpose: there is no foreign key into
-- the neon_auth schema, so this file also runs on a database or branch where Neon
-- Auth is not enabled yet, and deleting an auth user never fails on our tables.
-- The API deletes a user's rows itself when an account is removed, and a periodic
-- job looks for rows whose user no longer exists (see docs/ACCOUNTS.md).

create table if not exists models (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null check (user_id <> ''),
  -- Display name only. It never becomes part of a storage key or a path.
  name        text not null check (char_length(name) between 1 and 200),
  extension   text not null check (extension in ('.stl', '.obj', '.glb', '.ply', '.step', '.stp', '.iges', '.igs')),
  size_bytes  bigint not null check (
    size_bytes > 0
    and size_bytes <= 52428800
    -- STEP and IGES files are capped lower because their cost is in the conversion
    and (extension not in ('.step', '.stp', '.iges', '.igs') or size_bytes <= 20971520)
  ),
  unit        text not null default 'mm' check (unit in ('mm', 'cm', 'm', 'in')),
  -- Derived on the server only, never taken from the client. Tying it to the owner,
  -- the row id and the allowlisted extension rules out odd or foreign keys.
  storage_key text not null unique check (storage_key = 'users/' || user_id || '/' || id::text || extension),
  -- pending: the row exists and an upload link was issued.
  -- ready: the file is in storage and was verified. Terminal.
  -- failed: the upload or the verification failed. Terminal.
  -- The API only ever updates "where status = 'pending'".
  status      text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at  timestamptz not null default now(),
  uploaded_at timestamptz,
  check (status <> 'ready' or uploaded_at is not null)
);

create index if not exists models_user_created_idx on models (user_id, created_at desc);
-- For the cleanup job that removes uploads that never finished.
create index if not exists models_pending_idx on models (created_at) where status = 'pending';

-- A saved set of test conditions for one model, so "my models" can reopen a past run.
-- There is no user_id here: every query must join models and filter on models.user_id.
-- The bounds also reject NaN and infinity, because Postgres orders NaN above every number.
create table if not exists runs (
  id         uuid primary key default gen_random_uuid(),
  model_id   uuid not null references models (id) on delete cascade,
  wind_speed double precision not null check (wind_speed >= 0 and wind_speed <= 60),
  yaw_deg    double precision not null check (yaw_deg >= -90 and yaw_deg <= 90),
  cd         double precision not null check (cd >= 0 and cd <= 10),
  created_at timestamptz not null default now()
);

create index if not exists runs_model_created_idx on runs (model_id, created_at desc);
