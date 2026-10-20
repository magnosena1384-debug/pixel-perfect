-- RH: ocorrências do "Relatório de Irregularidades - Completo" do QuarkRH (FALTA, ATRASO, …),
-- uma linha por colaborador, tipo e data. Mesmas permissões do ponto (0008).

create table public.rh_irregularidades (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado, igual ao de rh_ponto_dias
  nome text not null,
  cpf text not null default '',
  cargo text not null default '',
  setor text not null default '',
  vinculo text not null default '',
  tipo text not null,
  data date not null,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador, tipo, data)
);
create index rh_irregularidades_data on public.rh_irregularidades(unidade_id, data);

grant select, insert, delete on public.rh_irregularidades to authenticated;
grant all on public.rh_irregularidades to service_role;
alter table public.rh_irregularidades enable row level security;

create policy "rh ver irregularidades" on public.rh_irregularidades for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar irregularidades" on public.rh_irregularidades for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar irregularidades" on public.rh_irregularidades for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca as ocorrências da unidade no período [_de, _ate] pelas enviadas, tudo ou nada.
create or replace function public.rh_gravar_irregularidades(
  _unidade uuid, _arquivo text, _de date, _ate date, _linhas jsonb
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  _importacao uuid;
  _n integer;
begin
  if not public.pode_gestao(auth.uid(), _unidade, 'rh-importar') then
    raise exception 'Você não tem permissão para importar o RH desta unidade.';
  end if;
  select count(*) into _n from jsonb_array_elements(_linhas) e
  where (e->>'data')::date between _de and _ate;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'irregularidades', _arquivo, _de, _ate, _n)
  returning id into _importacao;

  delete from public.rh_irregularidades where unidade_id = _unidade and data between _de and _ate;

  insert into public.rh_irregularidades (
    unidade_id, colaborador, nome, cpf, cargo, setor, vinculo, tipo, data, importacao_id
  )
  select _unidade, i.colaborador, i.nome, coalesce(i.cpf, ''), coalesce(i.cargo, ''),
    coalesce(i.setor, ''), coalesce(i.vinculo, ''), i.tipo, i.data, _importacao
  from jsonb_to_recordset(_linhas) as i(
    colaborador text, nome text, cpf text, cargo text, setor text, vinculo text, tipo text, data date
  )
  where i.data between _de and _ate;
  return _n;
end $$;

revoke execute on function public.rh_gravar_irregularidades(uuid, text, date, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_irregularidades(uuid, text, date, date, jsonb) to authenticated, service_role;
