-- Arquivos (PDF ou imagem) dos documentos da Regulação. Ficam no Storage, num espaço privado, em
-- "<unidade_id>/<arquivo>". Quem tem o módulo Regulação ("documentos") na unidade lê, anexa,
-- troca e apaga os arquivos daquela unidade; ninguém mais. O caminho do arquivo é guardado no
-- próprio documento (gestao_itens.dados.arquivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'regulacao-documentos',
  'regulacao-documentos',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- O primeiro pedaço do caminho tem de ser o id de uma unidade em que a pessoa tem Regulação.
create or replace function public.regulacao_pode_arquivo(_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(_caminho, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.pode_gestao(auth.uid(), split_part(_caminho, '/', 1)::uuid, 'documentos')
    else false
  end
$$;

revoke execute on function public.regulacao_pode_arquivo(text) from public, anon;
grant execute on function public.regulacao_pode_arquivo(text) to authenticated, service_role;

create policy "regulacao le arquivos" on storage.objects for select to authenticated
using (bucket_id = 'regulacao-documentos' and public.regulacao_pode_arquivo(name));

create policy "regulacao anexa arquivos" on storage.objects for insert to authenticated
with check (bucket_id = 'regulacao-documentos' and public.regulacao_pode_arquivo(name));

create policy "regulacao troca arquivos" on storage.objects for update to authenticated
using (bucket_id = 'regulacao-documentos' and public.regulacao_pode_arquivo(name))
with check (bucket_id = 'regulacao-documentos' and public.regulacao_pode_arquivo(name));

create policy "regulacao apaga arquivos" on storage.objects for delete to authenticated
using (bucket_id = 'regulacao-documentos' and public.regulacao_pode_arquivo(name));
