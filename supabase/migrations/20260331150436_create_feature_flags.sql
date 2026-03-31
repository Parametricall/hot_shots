create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into feature_flags (key, enabled) values ('cheating_report', false);
