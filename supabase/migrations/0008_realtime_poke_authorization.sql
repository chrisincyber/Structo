-- Private broadcast channels (§12.6) require an authorization policy on
-- realtime.messages: each user may receive broadcasts only on their own
-- 'user:{id}' topic. Supabase-only (the realtime schema does not exist on
-- vanilla Postgres) — CI skips this file via the guard below.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime schema absent (vanilla Postgres) — skipping poke authorization policy';
    return;
  end if;
  execute $pol$
    create policy "users receive their own pokes"
    on realtime.messages
    for select
    to authenticated
    using (
      realtime.topic() = 'user:' || auth.uid()::text
      and extension = 'broadcast'
    )
  $pol$;
end;
$$;
