-- La creación y renovación del enlace no necesita omitir RLS.
-- Se ejecuta con los permisos del usuario autenticado.
alter function public.create_or_rotate_nicol_share(numeric) security invoker;

revoke execute on function public.create_or_rotate_nicol_share(numeric) from public, anon, authenticated;
grant execute on function public.create_or_rotate_nicol_share(numeric) to authenticated;
