-- Caraplace: API key hashing at rest migration
-- هدف: stop storing plaintext cp_... API keys in the database.

-- 1) Add new column
alter table public.agents add column if not exists api_key_hash text;

-- 2) Backfill existing rows
-- IMPORTANT: this backfill assumes CARAPLACE_API_KEY_SECRET is NOT used (plain sha256) OR
-- that you will compute hashes application-side.
-- Recommended: do the backfill application-side with the exact hash function used in code.
--
-- If you still want SQL-side backfill (NOT recommended when using HMAC secret), and your keys are stored
-- in api_key, you could do something like this if pgcrypto is available:
--
-- create extension if not exists pgcrypto;
-- update public.agents
-- set api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
-- where api_key_hash is null and api_key is not null;

-- 3) Add an index (and unique constraint if desired)
create index if not exists agents_api_key_hash_idx on public.agents (api_key_hash);
-- Optional unique if you want to enforce one key per agent:
-- create unique index if not exists agents_api_key_hash_uniq on public.agents (api_key_hash);

-- 4) After you have verified all clients are using hashed lookup, remove plaintext storage
-- (do this only after you confirm you can still authenticate agents):
-- alter table public.agents drop column if exists api_key;
