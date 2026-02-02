-- Caraplace — Twitter/X verification v1
-- Adds a stable "humans" identity keyed by twitter_user_id
-- Locks agents after first claim by storing primary_human_id

-- 1) Humans table (one row per X account)
create table if not exists public.humans (
  id bigserial primary key,
  twitter_user_id text not null unique,
  twitter_handle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Add claim metadata to agents (safe if columns already exist)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agents' and column_name='primary_human_id') then
    alter table public.agents add column primary_human_id bigint null references public.humans(id);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agents' and column_name='claimed_by_twitter_user_id') then
    alter table public.agents add column claimed_by_twitter_user_id text null;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agents' and column_name='claim_tweet_id') then
    alter table public.agents add column claim_tweet_id text null;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agents' and column_name='claim_tweet_url') then
    alter table public.agents add column claim_tweet_url text null;
  end if;
end $$;

-- Optional: keep updated_at current
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_humans_updated_at on public.humans;
create trigger trg_touch_humans_updated_at
before update on public.humans
for each row execute function public.touch_updated_at();
