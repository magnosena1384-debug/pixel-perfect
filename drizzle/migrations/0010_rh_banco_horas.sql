-- RH: saldo do banco de horas por colaborador ("Relatório Sintético - Banco de Horas" do QuarkRH).
-- É uma foto: cada importação troca a foto inteira da unidade. Mesmas permissões do ponto (0008).

create table public.rh_banco_horas (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado, igual ao de rh_ponto_dias
  nome text not null,
  setor text not null default '',
  admissao date,
  credito_min integer not null default 0,
  debito_min integer not null default 0,
  saldo_min integer not null default 0,
  referencia date not null,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador)
);

grant select, insert, delete on public.rh_banco_horas to authenticated;
grant all on public.rh_banco_horas to service_role;
alter table public.rh_banco_horas enable row level security;

create policy "rh ver banco de horas" on public.rh_banco_horas for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar banco de horas" on public.rh_banco_horas for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar banco de horas" on public.rh_banco_horas for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca o banco de horas da unidade pelo enviado, tudo ou nada.
create or replace function public.rh_gravar_banco_horas(
  _unidade uuid, _arquivo text, _referencia date, _linhas jsonb
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  _importacao uuid;
  _n integer := jsonb_array_length(_linhas);
begin
  if not public.pode_gestao(auth.uid(), _unidade, 'rh-importar') then
    raise exception 'Você não tem permissão para importar o RH desta unidade.';
  end if;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'banco_horas', _arquivo, _referencia, _referencia, _n)
  returning id into _importacao;

  delete from public.rh_banco_horas where unidade_id = _unidade;

  insert into public.rh_banco_horas (
    unidade_id, colaborador, nome, setor, admissao, credito_min, debito_min, saldo_min, referencia,
    importacao_id
  )
  select _unidade, b.colaborador, b.nome, coalesce(b.setor, ''), b.admissao,
    coalesce(b.credito, 0), coalesce(b.debito, 0), coalesce(b.saldo, 0), _referencia, _importacao
  from jsonb_to_recordset(_linhas) as b(
    colaborador text, nome text, setor text, admissao date, credito integer, debito integer,
    saldo integer
  );
  return _n;
end $$;

revoke execute on function public.rh_gravar_banco_horas(uuid, text, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_banco_horas(uuid, text, date, jsonb) to authenticated, service_role;
