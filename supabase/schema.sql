-- SmartSched Supabase Database Schema & Row-Level Security (RLS) Policies
-- Run this SQL in your Supabase Dashboard -> SQL Editor to persist each student's
-- timetable events, assignments, reminders, study sessions, and notification preferences
-- with strict per-user isolation enforced by PostgreSQL RLS.

create table if not exists public.timetable_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  day text not null,
  start_time text not null,
  end_time text not null,
  venue text not null,
  type text not null,
  faculty text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.assignments (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  due_date text not null,
  due_time text not null,
  description text not null default '',
  status text not null default 'Pending',
  priority text not null default 'Medium',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.reminders (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id text not null,
  offset_minutes integer not null,
  enabled boolean not null default true,
  dismissed boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.study_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  date text not null,
  start_time text not null,
  duration_minutes integer not null,
  notes text not null default '',
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_reminders_enabled boolean not null default true,
  class_lead_minutes integer not null default 10,
  assignment_reminders_enabled boolean not null default true,
  assignment_default_lead_minutes integer not null default 60,
  study_reminders_enabled boolean not null default true,
  study_lead_minutes integer not null default 10,
  browser_notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security on all user tables
alter table public.timetable_events enable row level security;
alter table public.assignments enable row level security;
alter table public.reminders enable row level security;
alter table public.study_sessions enable row level security;
alter table public.notification_preferences enable row level security;

-- Timetable Events Policies
drop policy if exists "Students can select own timetable events" on public.timetable_events;
create policy "Students can select own timetable events"
  on public.timetable_events for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own timetable events" on public.timetable_events;
create policy "Students can insert own timetable events"
  on public.timetable_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update own timetable events" on public.timetable_events;
create policy "Students can update own timetable events"
  on public.timetable_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own timetable events" on public.timetable_events;
create policy "Students can delete own timetable events"
  on public.timetable_events for delete
  using (auth.uid() = user_id);

-- Assignments Policies
drop policy if exists "Students can select own assignments" on public.assignments;
create policy "Students can select own assignments"
  on public.assignments for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own assignments" on public.assignments;
create policy "Students can insert own assignments"
  on public.assignments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update own assignments" on public.assignments;
create policy "Students can update own assignments"
  on public.assignments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own assignments" on public.assignments;
create policy "Students can delete own assignments"
  on public.assignments for delete
  using (auth.uid() = user_id);

-- Reminders Policies
drop policy if exists "Students can select own reminders" on public.reminders;
create policy "Students can select own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own reminders" on public.reminders;
create policy "Students can insert own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update own reminders" on public.reminders;
create policy "Students can update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own reminders" on public.reminders;
create policy "Students can delete own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);

-- Study Sessions Policies
drop policy if exists "Students can select own study sessions" on public.study_sessions;
create policy "Students can select own study sessions"
  on public.study_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own study sessions" on public.study_sessions;
create policy "Students can insert own study sessions"
  on public.study_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update own study sessions" on public.study_sessions;
create policy "Students can update own study sessions"
  on public.study_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own study sessions" on public.study_sessions;
create policy "Students can delete own study sessions"
  on public.study_sessions for delete
  using (auth.uid() = user_id);

-- Notification Preferences Policies
drop policy if exists "Students can select own notification prefs" on public.notification_preferences;
create policy "Students can select own notification prefs"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own notification prefs" on public.notification_preferences;
create policy "Students can insert own notification prefs"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update own notification prefs" on public.notification_preferences;
create policy "Students can update own notification prefs"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own notification prefs" on public.notification_preferences;
create policy "Students can delete own notification prefs"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);
