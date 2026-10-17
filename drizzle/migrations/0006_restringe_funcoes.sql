-- Fecha funções internas que não precisam ser chamadas pela API (alerta do Supabase Advisor).
-- handle_new_user só roda como gatilho de cadastro.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Visitantes sem login só precisam de has_role (usada nas regras do catálogo público).
revoke execute on function public.can_access_lesson(uuid, uuid) from public, anon;
revoke execute on function public.has_active_enrollment(uuid, uuid) from public, anon;
revoke execute on function public.lesson_course_id(uuid) from public, anon;
revoke execute on function public.pode_gestao(uuid, uuid, text) from public, anon;
grant execute on function public.can_access_lesson(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_active_enrollment(uuid, uuid) to authenticated, service_role;
grant execute on function public.lesson_course_id(uuid) to authenticated, service_role;
grant execute on function public.pode_gestao(uuid, uuid, text) to authenticated, service_role;
