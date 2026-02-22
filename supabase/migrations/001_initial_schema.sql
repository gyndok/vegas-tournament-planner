-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Series table
create table series (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  venue text not null,
  start_date date not null,
  end_date date not null,
  website_url text,
  created_at timestamptz default now()
);

-- Tournaments table
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid references series(id) on delete cascade,
  event_number integer not null,
  name text not null,
  date date not null,
  day_of_week text not null,
  start_time time not null,
  buy_in integer not null,
  game_type text not null,
  format text not null default 'Re-entry',
  table_size integer not null default 9,
  starting_stack integer,
  blind_levels_minutes integer,
  late_reg_levels integer,
  late_reg_end_time time,
  guaranteed_prize integer,
  is_flight boolean not null default false,
  flight_label text,
  parent_event_number integer,
  estimated_duration_hours float,
  notes text,
  created_at timestamptz default now()
);

-- User preferences table
create table user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  buy_in_min integer,
  buy_in_max integer,
  preferred_games text[] default '{}',
  preferred_formats text[] default '{}',
  preferred_start_time_earliest time,
  preferred_start_time_latest time,
  preferred_table_size integer[] default '{}',
  avoid_turbos boolean default false,
  trip_start date,
  trip_end date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- User schedule table
create table user_schedule (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tournament_id uuid references tournaments(id) on delete cascade not null,
  priority text not null default 'maybe' check (priority in ('target', 'backup', 'maybe')),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, tournament_id)
);

-- Indexes
create index idx_tournaments_date_time on tournaments(date, start_time);
create index idx_tournaments_series on tournaments(series_id);
create index idx_tournaments_buy_in on tournaments(buy_in);
create index idx_tournaments_game_type on tournaments(game_type);
create index idx_user_schedule_user on user_schedule(user_id);

-- Row Level Security
alter table series enable row level security;
alter table tournaments enable row level security;
alter table user_preferences enable row level security;
alter table user_schedule enable row level security;

-- Public read for series and tournaments
create policy "Anyone can read series" on series for select using (true);
create policy "Anyone can read tournaments" on tournaments for select using (true);

-- Authenticated users manage own preferences
create policy "Users read own preferences" on user_preferences for select using (auth.uid() = user_id);
create policy "Users insert own preferences" on user_preferences for insert with check (auth.uid() = user_id);
create policy "Users update own preferences" on user_preferences for update using (auth.uid() = user_id);

-- Authenticated users manage own schedule
create policy "Users read own schedule" on user_schedule for select using (auth.uid() = user_id);
create policy "Users insert own schedule" on user_schedule for insert with check (auth.uid() = user_id);
create policy "Users update own schedule" on user_schedule for update using (auth.uid() = user_id);
create policy "Users delete own schedule" on user_schedule for delete using (auth.uid() = user_id);

-- Service role can write series and tournaments (for admin import)
create policy "Service role writes series" on series for all using (auth.role() = 'service_role');
create policy "Service role writes tournaments" on tournaments for all using (auth.role() = 'service_role');
