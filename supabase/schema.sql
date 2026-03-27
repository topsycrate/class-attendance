create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  email text,
  student_id text not null,
  name text not null,
  class_name text,
  created_at timestamptz not null default now()
);

alter table public.students
  add column if not exists email text,
  add column if not exists student_id text,
  add column if not exists name text,
  add column if not exists class_name text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists students_student_id_key on public.students(student_id);

create table if not exists public.device_bindings (
  id uuid primary key default gen_random_uuid(),
  student_ref uuid not null references public.students(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists device_bindings_student_ref_key
  on public.device_bindings(student_ref);
create unique index if not exists device_bindings_device_id_key
  on public.device_bindings(device_id);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  course_name text not null default '英语听力',
  session_date date not null,
  sign_code text not null,
  duration_minutes integer not null default 15,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_ref uuid not null references public.attendance_sessions(id) on delete cascade,
  student_ref uuid not null references public.students(id) on delete cascade,
  sign_time timestamptz not null default now(),
  device_id text not null
);

create unique index if not exists attendance_records_session_student_key
  on public.attendance_records(session_ref, student_ref);

alter table public.students enable row level security;
alter table public.device_bindings enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.device_bindings from anon, authenticated;
revoke all on public.attendance_sessions from anon, authenticated;
revoke all on public.attendance_records from anon, authenticated;
