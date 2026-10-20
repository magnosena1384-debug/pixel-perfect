-- RH: ponto diário importado do "Relatório de Frequência Analítico" do QuarkRH.
-- Permissões por unidade em gestao_acessos.modulos: 'rh' (ver) e 'rh-importar' (gravar).
-- A gravação só acontece pela função rh_gravar_ponto, que troca o período inteiro de uma vez.

create table public.rh_importacoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  relatorio text not null check (relatorio in ('frequencia', 'irregularidades', 'banco_horas')),
  arquivo text not null,
  periodo_de date,
  periodo_ate date,
  quantidade integer not null default 0,
  feito_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index rh_importacoes_unidade on public.rh_importacoes(unidade_id, criado_em desc);

create table public.rh_ponto_dias (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado (sem acento, maiúsculo)
  nome text not null,
  data date not null,
  jornada text not null default '',
  batidas text[] not null default '{}',
  diurna_min integer not null default 0,
  noturna_min integer not null default 0,
  extras_min integer not null default 0,
  extras100_min integer not null default 0,
  hn_min integer not null default 0,
  descontos_min integer not null default 0,
  observacao text not null default '',
  folga boolean not null default false,
  trabalhou boolean not null default false,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador, data)
);
create index rh_ponto_dias_data on public.rh_ponto_dias(unidade_id, data);

grant select, insert, delete on public.rh_importacoes, public.rh_ponto_dias to authenticated;
grant all on public.rh_importacoes, public.rh_ponto_dias to service_role;
alter table public.rh_importacoes enable row level security;
alter table public.rh_ponto_dias enable row level security;

create policy "rh ver importacoes" on public.rh_importacoes for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh registrar importacao" on public.rh_importacoes for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

create policy "rh ver ponto" on public.rh_ponto_dias for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar ponto" on public.rh_ponto_dias for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar ponto" on public.rh_ponto_dias for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca os dias de ponto, no período [_de, _ate], das pessoas que vieram no arquivo; tudo ou nada.
-- Roda com as permissões de quem chama (as regras acima continuam valendo).
create or replace function public.rh_gravar_ponto(
  _unidade uuid, _arquivo text, _de date, _ate date, _dias jsonb
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
  select count(*) into _n from jsonb_array_elements(_dias) e
  where (e->>'data')::date between _de and _ate;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'frequencia', _arquivo, _de, _ate, _n)
  returning id into _importacao;

  -- Só troca quem veio no arquivo: um relatório filtrado para uma pessoa não apaga as outras.
  delete from public.rh_ponto_dias
  where unidade_id = _unidade and data between _de and _ate
    and colaborador in (select e->>'colaborador' from jsonb_array_elements(_dias) e);

  insert into public.rh_ponto_dias (
    unidade_id, colaborador, nome, data, jornada, batidas, diurna_min, noturna_min, extras_min,
    extras100_min, hn_min, descontos_min, observacao, folga, trabalhou, importacao_id
  )
  select _unidade, d.colaborador, d.nome, d.data, coalesce(d.jornada, ''),
    coalesce(d.batidas, '{}'), coalesce(d.diurna_min, 0), coalesce(d.noturna_min, 0),
    coalesce(d.extras_min, 0), coalesce(d.extras100_min, 0), coalesce(d.hn_min, 0),
    coalesce(d.descontos_min, 0), coalesce(d.observacao, ''), coalesce(d.folga, false),
    coalesce(d.trabalhou, false), _importacao
  from jsonb_to_recordset(_dias) as d(
    colaborador text, nome text, data date, jornada text, batidas text[], diurna_min integer,
    noturna_min integer, extras_min integer, extras100_min integer, hn_min integer,
    descontos_min integer, observacao text, folga boolean, trabalhou boolean
  )
  where d.data between _de and _ate;
  return _n;
end $$;

revoke execute on function public.rh_gravar_ponto(uuid, text, date, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_ponto(uuid, text, date, date, jsonb) to authenticated, service_role;
