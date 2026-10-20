-- Patrimônio: bens com tombamento único no grupo e histórico de cada um.
-- Permissões por empresa em gestao_acessos.modulos: 'patrimonio' (ver) e 'patrimonio-gerenciar'.
-- Ninguém escreve direto nas tabelas: toda escrita passa pelas funções abaixo, que conferem a
-- permissão e gravam o histórico.

-- Nome de quem está agindo, para o histórico (o gerente não lê o perfil de outras pessoas).
create or replace function public.patrimonio_nome_usuario()
returns text language sql stable security definer set search_path = public
as $ select coalesce((select nome from public.profiles where id = auth.uid()), '') $;

create table public.patrimonio_bens (
  id uuid primary key default gen_random_uuid(),
  -- Sequência do banco: dois cadastros ao mesmo tempo nunca recebem o mesmo número.
  tombamento bigint generated always as identity unique,
  unidade_id uuid not null references public.unidades(id),
  setor text not null default '',
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null,
  marca text not null default '',
  modelo text not null default '',
  numero_serie text,
  data_compra date not null,
  valor_compra_centavos bigint not null check (valor_compra_centavos >= 0),
  vida_util_anos integer not null check (vida_util_anos between 0 and 100),
  situacao text not null default 'em_uso'
    check (situacao in ('em_uso', 'com_defeito', 'em_transito', 'baixado')),
  baixa_data date,
  baixa_motivo text,
  baixa_obs text,
  reimprimir_etiqueta boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null default auth.uid()
);
create index patrimonio_bens_unidade on public.patrimonio_bens(unidade_id);
create index patrimonio_bens_serie on public.patrimonio_bens(lower(numero_serie));

create table public.patrimonio_historico (
  id bigint generated always as identity primary key,
  bem_id uuid not null references public.patrimonio_bens(id) on delete cascade,
  quando timestamptz not null default now(),
  quem uuid references auth.users(id) on delete set null default auth.uid(),
  -- Nome gravado na hora: o gerente não lê o perfil de outras pessoas.
  quem_nome text not null default public.patrimonio_nome_usuario(),
  evento text not null,
  detalhe text not null default ''
);
create index patrimonio_historico_bem on public.patrimonio_historico(bem_id, quando desc);

grant select on public.patrimonio_bens, public.patrimonio_historico to authenticated;
grant all on public.patrimonio_bens, public.patrimonio_historico to service_role;
alter table public.patrimonio_bens enable row level security;
alter table public.patrimonio_historico enable row level security;

create policy "patrimonio ver bens" on public.patrimonio_bens for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'patrimonio')
    or public.pode_gestao(auth.uid(), unidade_id, 'patrimonio-gerenciar'));
-- O histórico segue o bem: quem vê o bem vê o histórico dele.
create policy "patrimonio ver historico" on public.patrimonio_historico for select to authenticated
using (exists (select 1 from public.patrimonio_bens b where b.id = bem_id));

create or replace function public.patrimonio_pode_gerenciar(_unidade uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.pode_gestao(auth.uid(), _unidade, 'patrimonio-gerenciar') $$;

-- Cadastra um bem. Se o nº de série já existe num bem não baixado, devolve {repetido: …} sem
-- gravar; com "confirmar_serie_repetida": true, grava mesmo assim.
create or replace function public.patrimonio_cadastrar(_unidade uuid, _dados jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _serie text := nullif(trim(_dados->>'numero_serie'), '');
  _rep record;
  _bem record;
begin
  if not public.patrimonio_pode_gerenciar(_unidade) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _serie is not null and not coalesce((_dados->>'confirmar_serie_repetida')::boolean, false) then
    select b.id, b.tombamento, b.nome, u.nome as empresa into _rep
    from public.patrimonio_bens b join public.unidades u on u.id = b.unidade_id
    where lower(b.numero_serie) = lower(_serie) and b.situacao <> 'baixado'
    limit 1;
    if found then
      return jsonb_build_object('repetido', jsonb_build_object(
        'id', _rep.id, 'tombamento', _rep.tombamento, 'nome', _rep.nome, 'empresa', _rep.empresa));
    end if;
  end if;

  insert into public.patrimonio_bens (
    unidade_id, setor, nome, categoria, marca, modelo, numero_serie, data_compra,
    valor_compra_centavos, vida_util_anos
  ) values (
    _unidade, coalesce(trim(_dados->>'setor'), ''), trim(_dados->>'nome'), _dados->>'categoria',
    coalesce(trim(_dados->>'marca'), ''), coalesce(trim(_dados->>'modelo'), ''), _serie,
    (_dados->>'data_compra')::date, (_dados->>'valor_compra_centavos')::bigint,
    (_dados->>'vida_util_anos')::integer
  ) returning id, tombamento into _bem;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem.id, 'cadastro', (select nome from public.unidades where id = _unidade));
  return jsonb_build_object('id', _bem.id, 'tombamento', _bem.tombamento);
end $$;

-- Edita os dados de um bem. A empresa não muda aqui (só por transferência); bem em trânsito ou
-- baixado não é editado. Situação aceita só 'em_uso' ou 'com_defeito'.
create or replace function public.patrimonio_editar(_id uuid, _dados jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _bem public.patrimonio_bens;
  _situacao text := coalesce(_dados->>'situacao', 'em_uso');
begin
  select * into _bem from public.patrimonio_bens where id = _id for update;
  if not found or not public.patrimonio_pode_gerenciar(_bem.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _bem.situacao in ('em_transito', 'baixado') then
    raise exception 'Bem em trânsito ou baixado não pode ser editado.';
  end if;
  if _situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Situação inválida.';
  end if;

  update public.patrimonio_bens set
    setor = coalesce(trim(_dados->>'setor'), ''),
    nome = trim(_dados->>'nome'),
    categoria = _dados->>'categoria',
    marca = coalesce(trim(_dados->>'marca'), ''),
    modelo = coalesce(trim(_dados->>'modelo'), ''),
    numero_serie = nullif(trim(_dados->>'numero_serie'), ''),
    data_compra = (_dados->>'data_compra')::date,
    valor_compra_centavos = (_dados->>'valor_compra_centavos')::bigint,
    vida_util_anos = (_dados->>'vida_util_anos')::integer,
    situacao = _situacao
  where id = _id;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_id, 'edicao', case
    when _bem.setor is distinct from coalesce(trim(_dados->>'setor'), '')
      then format('Setor: %s → %s', coalesce(nullif(_bem.setor, ''), '—'), coalesce(nullif(trim(_dados->>'setor'), ''), '—'))
    when _bem.situacao <> _situacao
      then case _situacao when 'com_defeito' then 'Marcado com defeito' else 'Voltou a uso' end
    else 'Dados atualizados' end);
end $$;

revoke execute on function public.patrimonio_nome_usuario() from public, anon;
revoke execute on function public.patrimonio_pode_gerenciar(uuid) from public, anon;
revoke execute on function public.patrimonio_cadastrar(uuid, jsonb) from public, anon;
revoke execute on function public.patrimonio_editar(uuid, jsonb) from public, anon;
grant execute on function public.patrimonio_nome_usuario() to authenticated, service_role;
grant execute on function public.patrimonio_pode_gerenciar(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_cadastrar(uuid, jsonb) to authenticated, service_role;
grant execute on function public.patrimonio_editar(uuid, jsonb) to authenticated, service_role;
