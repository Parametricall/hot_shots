insert into feature_flags (key, enabled)
values ('judy_report', false)
on conflict (key) do nothing;
