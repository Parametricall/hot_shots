create table user_roles (
  user_id text not null,
  role text not null check (role in ('admin')),
  created_at timestamptz default now(),
  primary key (user_id, role)
);

-- Seed the owner as admin
insert into user_roles (user_id, role)
values ('user_363pnsrURsRhYonaDlnFniXQ1Ar', 'admin')
on conflict do nothing;
