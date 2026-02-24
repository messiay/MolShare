-- Fix the foreign key to allow joining profiles
-- 1. Drop the old constraint referencing auth.users
alter table public.comments
drop constraint comments_user_id_fkey;

-- 2. Add new constraint referencing public.profiles
alter table public.comments
add constraint comments_user_id_fkey
foreign key (user_id) references public.profiles(id)
on delete cascade;
