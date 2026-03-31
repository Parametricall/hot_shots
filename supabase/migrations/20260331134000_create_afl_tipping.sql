create table afl_tipping (
  game_id integer not null,
  user_id text not null,
  tip integer not null,
  margin integer,
  created_at timestamptz default now(),
  primary key (game_id, user_id)
);
