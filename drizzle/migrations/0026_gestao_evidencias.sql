-- Fotos de evidência das rotinas administrativas e das inspeções da Manutenção. Ficam no Storage,
-- num espaço privado, em "<unidade_id>/<modulo>/<arquivo>" (modulo = rotinas ou manutencao).
-- Quem tem o módulo na unidade lê, anexa, troca e apaga as fotos daquela unidade e daquele
-- módulo; ninguém mais. O caminho de cada foto é guardado no próprio registro (gestao_itens.dados).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gestao-evidencias',
  'gestao-evidencias',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- O 1º pedaço do caminho é a unidade; o 2º, o módulo. A pessoa precisa ter aquele módulo na unidade.
create or replace function public.evidencia_pode(_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(_caminho, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(_caminho, '/', 2) in ('rotinas', 'manutencao')
    then public.pode_gestao(
      auth.uid(),
      split_part(_caminho, '/', 1)::uuid,
      split_part(_caminho, '/', 2)
    )
    else false
  end
$$;

revoke execute on function public.evidencia_pode(text) from public, anon;
grant execute on function public.evidencia_pode(text) to authenticated, service_role;

create policy "evidencias leem fotos" on storage.objects for select to authenticated
using (bucket_id = 'gestao-evidencias' and public.evidencia_pode(name));

create policy "evidencias anexam fotos" on storage.objects for insert to authenticated
with check (bucket_id = 'gestao-evidencias' and public.evidencia_pode(name));

create policy "evidencias trocam fotos" on storage.objects for update to authenticated
using (bucket_id = 'gestao-evidencias' and public.evidencia_pode(name))
with check (bucket_id = 'gestao-evidencias' and public.evidencia_pode(name));

create policy "evidencias apagam fotos" on storage.objects for delete to authenticated
using (bucket_id = 'gestao-evidencias' and public.evidencia_pode(name));
