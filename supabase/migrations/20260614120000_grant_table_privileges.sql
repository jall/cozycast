-- ============================================================
-- Grant base table privileges to the authenticated role.
--
-- The initial schema enabled RLS and defined policies but never granted
-- base-table privileges. Postgres checks GRANTs *before* RLS, so every
-- query failed with "permission denied for table ..." before any policy
-- was evaluated. RLS still constrains which rows each user may touch;
-- these grants simply let the policies come into play.
--
-- Grants are intentionally scoped to match the existing RLS policies.
-- ============================================================

-- profiles: any authenticated user can read; users update their own row.
-- INSERT is performed by the handle_new_user trigger (SECURITY DEFINER),
-- so no INSERT grant is needed here.
grant select, update on public.profiles to authenticated;

-- friendships: users read their own rows. INSERT/DELETE happen inside the
-- redeem_invite SECURITY DEFINER function, not via direct table access.
grant select on public.friendships to authenticated;

-- invites: users read and create their own. UPDATE (marking an invite used)
-- happens inside the redeem_invite SECURITY DEFINER function.
grant select, insert on public.invites to authenticated;

-- casts: users create, read (own or friends'), and delete their own.
grant select, insert, delete on public.casts to authenticated;
