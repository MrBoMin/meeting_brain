-- Auto-create a profile row when a new user signs up
-- Run this in Supabase SQL Editor AFTER running schema.sql

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, preferred_language)
  values (
    new.id,
    new.email,
    'my-MM'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
