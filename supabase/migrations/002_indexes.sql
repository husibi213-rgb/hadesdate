-- =========================================================
-- HADES DATA — 002 indexes
-- 방송 데이터는 장기적으로 수백만 행까지 늘어날 수 있다.
-- =========================================================

-- broadcasts
create index if not exists idx_broadcasts_member        on public.broadcasts(member_id);
create index if not exists idx_broadcasts_started       on public.broadcasts(started_at desc);
create index if not exists idx_broadcasts_status        on public.broadcasts(status) where status = 'live';
create index if not exists idx_broadcasts_date          on public.broadcasts(broadcast_date desc);
create index if not exists idx_broadcasts_member_date   on public.broadcasts(member_id, broadcast_date desc);

-- viewer_snapshots
create index if not exists idx_viewer_snapshots_bc      on public.viewer_snapshots(broadcast_id, recorded_at);

-- catches
create index if not exists idx_catches_broadcast        on public.catches(broadcast_id);
create index if not exists idx_catches_member           on public.catches(member_id);
create index if not exists idx_catches_created          on public.catches(created_at desc);
create index if not exists idx_catches_views            on public.catches(views desc);
create index if not exists idx_catches_likes            on public.catches(likes desc);

-- click_events
create index if not exists idx_click_events_broadcast   on public.click_events(broadcast_id, clicked_at desc);
create index if not exists idx_click_events_member      on public.click_events(member_id, clicked_at desc);
create index if not exists idx_click_events_clicked     on public.click_events(clicked_at desc);
create index if not exists idx_click_events_target      on public.click_events(target_type, clicked_at desc);

-- notices
create index if not exists idx_notices_published        on public.notices(published_at desc);
create index if not exists idx_notices_source           on public.notices(source, published_at desc);

-- member_notices
create index if not exists idx_member_notices_notice    on public.member_notices(notice_id);
