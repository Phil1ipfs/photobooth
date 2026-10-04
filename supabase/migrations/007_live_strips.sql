-- PhotoBooth — Live Strips (boomerang photostrips). Run AFTER 006. Safe to re-run.
-- Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- A Live Strip is saved as its own media type (not a fake static strip):
--   storage_path → the animation (WebM; MP4 on Safari; GIF if video recording is unavailable)
--   poster_path  → a JPEG still used for thumbnails
-- Entitlements are unchanged: saving still requires a finalized photostrip
-- creation (005), so a Live Strip counts toward the Free plan's 2 photostrips.

alter table public.strips add column if not exists media_type text not null default 'photo';
alter table public.strips add column if not exists poster_path text;
alter table public.strips add column if not exists mime_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'strips_media_type_check') then
    alter table public.strips add constraint strips_media_type_check check (media_type in ('photo', 'live_strip'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strips_live_has_poster') then
    alter table public.strips add constraint strips_live_has_poster check (media_type <> 'live_strip' or poster_path is not null);
  end if;
end $$;

-- Private bucket: also accept short videos (25 MB cap per file).
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/gif', 'video/webm', 'video/mp4'],
    file_size_limit = 26214400
where id = 'strips';
