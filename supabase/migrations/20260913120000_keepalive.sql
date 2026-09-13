-- ============================================================
-- keepalive(): a deliberately boring query, for pause prevention.
--
-- Supabase pauses Free plan projects that show too little *user database
-- activity* over a 7-day window, and a paused project can only be restored
-- for 90 days before a downloadable backup is all that's left. The daily
-- job in .github/workflows/keepalive.yml calls this function so the project
-- always has recent, genuine queries behind it.
--
-- It reads nothing: it returns the server clock. That keeps the function
-- outside the sharing model entirely — there is no data for it to leak and
-- no RLS interaction to reason about. What the pause heuristic cares about
-- is that a statement was parsed, planned and executed by Postgres on
-- behalf of a user role, and calling this does exactly that.
--
-- Marked volatile so the planner can never fold it away (it also means
-- PostgREST requires POST rather than GET to invoke it).
--
-- anon gets EXECUTE because the job authenticates with the publishable
-- (anon) key. A keepalive must never be handed the service-role key just to
-- keep a project warm — it needs no privileges at all.
-- ============================================================

create or replace function public.keepalive()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select now();
$$;

comment on function public.keepalive() is
  'No-op ping used by the scheduled keepalive job to prevent Free plan pausing. Reads no data.';

-- `public` here is the Postgres pseudo-role every role inherits, not the
-- schema: revoke the implicit grant, then hand EXECUTE back explicitly.
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
