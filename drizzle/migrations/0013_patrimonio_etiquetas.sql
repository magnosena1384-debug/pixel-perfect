-- Patrimônio: registra a impressão de etiquetas. Cada bem impresso ganha um evento no histórico
-- e sai da lista "Etiquetas para reimprimir". Só para bens de empresas que a pessoa gerencia.
create or replace function public.patrimonio_etiquetas_impressas(_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  _n integer;
begin
  if exists (
    select 1 from public.patrimonio_bens b
    where b.id = any(_ids) and not public.patrimonio_pode_gerenciar(b.unidade_id)
  ) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio de uma dessas empresas.';
  end if;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  select b.id, 'etiqueta', case when b.reimprimir_etiqueta then 'Reimpressão' else '' end
  from public.patrimonio_bens b
  where b.id = any(_ids) and b.situacao <> 'baixado';
  get diagnostics _n = row_count;

  update public.patrimonio_bens set reimprimir_etiqueta = false
  where id = any(_ids) and reimprimir_etiqueta;
  return _n;
end $$;

revoke execute on function public.patrimonio_etiquetas_impressas(uuid[]) from public, anon;
grant execute on function public.patrimonio_etiquetas_impressas(uuid[]) to authenticated, service_role;
