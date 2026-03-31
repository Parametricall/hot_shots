create table cheating_reports (
  id serial primary key,
  reported_user_id text not null,
  reporter_user_id text not null,
  created_at timestamptz default now()
);
