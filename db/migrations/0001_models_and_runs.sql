-- Saved models and test runs.
--
-- user_id holds the Neon Auth user id (the `sub` claim of the sign-in token, which
-- is neon_auth."user".id). It is plain text on purpose: there is no foreign key into
-- the neon_auth schema, so this file also runs on a database or branch where Neon
-- Auth is not enabled yet, and deleting an auth user never fails on our tables.
-- The API deletes a user's rows itself when an account is removed.

create table if not exists models (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null check (char_length(name) between 1 and 200),
  extension   text not null check (extension in ('.stl', '.obj', '.glb', '.ply', '.step', '.stp', '.iges', '.igs')),
  size_bytes  bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  unit        text not null default 'mm' check (unit in ('mm', 'cm', 'm', 'in')),
  storage_key text not null unique,
  -- pending: the row exists and the upload link was issued. ready: the file is in storage.
  status      text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at  timestamptz not null default now(),
  uploaded_at timestamptz
);

create index if not exists models_user_created_idx on models (user_id, created_at desc);

-- A saved set of test conditions for one model, so "my models" can reopen a past run.
create table if not exists runs (
  id         uuid primary key default gen_random_uuid(),
  model_id   uuid not null references models (id) on delete cascade,
  wind_speed double precision not null check (wind_speed >= 0 and wind_speed <= 60),
  yaw_deg    double precision not null check (yaw_deg >= -90 and yaw_deg <= 90),
  cd         double precision not null check (cd >= 0 and cd <= 10),
  created_at timestamptz not null default now()
);

create index if not exists runs_model_created_idx on runs (model_id, created_at desc);
