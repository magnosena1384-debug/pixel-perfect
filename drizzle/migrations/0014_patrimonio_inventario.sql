-- Patrimônio: inventário por empresa. Um inventário aberto por empresa de cada vez; cada leitura
-- fica guardada (uma por bem). Quem tem 'patrimonio' na empresa abre, lê, marca defeito, usa
-- "bem sem etiqueta" e fecha. Ninguém escreve direto nas tabelas.

create table public.patrimonio_inventarios (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id),
  aberto_em timestamptz not null default now(),
  aberto_por_nome text not null default public.patrimonio_nome_usuario(),
  fechado_em timestamptz,
  fechado_por_nome text
);
create unique index patrimonio_inventario_aberto on public.patrimonio_inventarios(unidade_id)
  where fechado_em is null;

create table public.patrimonio_leituras (
  inventario_id uuid not null references public.patrimonio_inventarios(id) on delete cascade,
  bem_id uuid not null references public.patrimonio_bens(id),
  lido_em timestamptz not null default now(),
  lido_por_nome text not null default public.patrimonio_nome_usuario(),
  com_defeito boolean not null default false,
  sem_etiqueta boolean not null default false,
  -- Bem de outra empresa lido aqui: fica registrado para o relatório, mas não conta.
  fora_da_empresa boolean not null default false,
  aviso text not null default '',
  primary key (inventario_id, bem_id)
);

grant select on public.patrimonio_inventarios, public.patrimonio_leituras to authenticated;
grant all on public.patrimonio_inventarios, public.patrimonio_leituras to service_role;
alter table public.patrimonio_inventarios enable row level security;
alter table public.patrimonio_leituras enable row level security;

create policy "patrimonio ver inventarios" on public.patrimonio_inventarios for select
to authenticated using (public.patrimonio_pode_ver(unidade_id));
create policy "patrimonio ver leituras" on public.patrimonio_leituras for select to authenticated
using (exists (select 1 from public.patrimonio_inventarios i where i.id = inventario_id));

-- Abre o inventário da empresa, ou devolve o que já está aberto.
create or replace function public.patrimonio_abrir_inventario(_unidade uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _id uuid;
begin
  if not public.patrimonio_pode_ver(_unidade) then
    raise exception 'Você não tem acesso ao Patrimônio nesta empresa.';
  end if;
  -- Dois aparelhos abrindo ao mesmo tempo: o índice único segura e os dois pegam o mesmo.
  insert into public.patrimonio_inventarios (unidade_id) values (_unidade)
  on conflict (unidade_id) where fechado_em is null do nothing;
  select id into _id from public.patrimonio_inventarios
  where unidade_id = _unidade and fechado_em is null;
  return _id;
end $$;

-- Confere o inventário: existe, está aberto e a pessoa tem acesso à empresa dele.
create or replace function public.patrimonio_inventario_aberto(_inventario uuid)
returns public.patrimonio_inventarios
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios;
begin
  select * into _inv from public.patrimonio_inventarios where id = _inventario;
  if not found or not public.patrimonio_pode_ver(_inv.unidade_id) then
    raise exception 'Você não tem acesso a este inventário.';
  end if;
  if _inv.fechado_em is not null then
    raise exception 'Este inventário já foi fechado.';
  end if;
  return _inv;
end $$;

-- Lê uma etiqueta. Devolve {status, bem}: encontrado, ja_lido, outra_empresa, em_transito,
-- baixado ou nao_existe. Só "encontrado" conta para o inventário. De outra empresa devolve só o
-- número e a empresa: quem lê não descobre os bens dos outros postos varrendo os números.
create or replace function public.patrimonio_ler(_inventario uuid, _tombamento bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
  _bem record;
  _info jsonb;
  _status text;
begin
  select b.id, b.tombamento, b.nome, b.unidade_id, b.situacao, u.nome as empresa into _bem
  from public.patrimonio_bens b join public.unidades u on u.id = b.unidade_id
  where b.tombamento = _tombamento;
  if not found then
    return jsonb_build_object('status', 'nao_existe', 'numero', _tombamento);
  end if;
  if _bem.unidade_id <> _inv.unidade_id then
    insert into public.patrimonio_leituras (inventario_id, bem_id, fora_da_empresa, aviso)
    values (_inventario, _bem.id, true, format('%s (%s)', lpad(_bem.tombamento::text, 6, '0'), _bem.empresa))
    on conflict do nothing;
    return jsonb_build_object('status', 'outra_empresa',
      'bem', jsonb_build_object('tombamento', _bem.tombamento, 'empresa', _bem.empresa));
  end if;

  _info := jsonb_build_object('id', _bem.id, 'tombamento', _bem.tombamento, 'nome', _bem.nome, 'empresa', _bem.empresa);
  if _bem.situacao = 'baixado' then
    _status := 'baixado';
  elsif _bem.situacao = 'em_transito' then
    _status := 'em_transito';
  else
    -- Duas leituras ao mesmo tempo do mesmo bem: a chave segura e a segunda vira "já lido".
    insert into public.patrimonio_leituras (inventario_id, bem_id) values (_inventario, _bem.id)
    on conflict do nothing;
    _status := case when found then 'encontrado' else 'ja_lido' end;
  end if;
  return jsonb_build_object('status', _status, 'bem', _info);
end $$;

-- Marca (ou desmarca) defeito num bem já lido neste inventário; muda a situação do bem.
create or replace function public.patrimonio_marcar_defeito(_inventario uuid, _bem uuid, _defeito boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
begin
  update public.patrimonio_leituras set com_defeito = _defeito
  where inventario_id = _inventario and bem_id = _bem and not fora_da_empresa;
  if not found then
    raise exception 'Este bem não foi lido neste inventário.';
  end if;
  update public.patrimonio_bens
  set situacao = case when _defeito then 'com_defeito' else 'em_uso' end
  where id = _bem and unidade_id = _inv.unidade_id and situacao in ('em_uso', 'com_defeito');
  if found then
    insert into public.patrimonio_historico (bem_id, evento, detalhe)
    values (_bem, 'edicao', case when _defeito then 'Marcado com defeito no inventário' else 'Voltou a uso no inventário' end);
  end if;
end $$;

-- Bem achado sem etiqueta: conta como encontrado e vai para "Etiquetas para reimprimir".
create or replace function public.patrimonio_sem_etiqueta(_inventario uuid, _bem uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
begin
  if not exists (
    select 1 from public.patrimonio_bens
    where id = _bem and unidade_id = _inv.unidade_id and situacao in ('em_uso', 'com_defeito')
  ) then
    raise exception 'Este bem não é desta empresa ou não está em uso.';
  end if;
  if exists (select 1 from public.patrimonio_leituras where inventario_id = _inventario and bem_id = _bem) then
    raise exception 'Este bem já foi lido neste inventário.';
  end if;
  insert into public.patrimonio_leituras (inventario_id, bem_id, sem_etiqueta) values (_inventario, _bem, true);
  update public.patrimonio_bens set reimprimir_etiqueta = true where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'inventario', 'Encontrado sem etiqueta; etiqueta para reimprimir');
end $$;

-- Fecha o inventário: grava no histórico de cada bem esperado se foi encontrado ou não (sem dar
-- baixa) e devolve o relatório.
create or replace function public.patrimonio_fechar_inventario(_inventario uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
  _quando text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  _nao_encontrados jsonb;
begin
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  select b.id, 'inventario',
    case when l.bem_id is null then format('Não encontrado no inventário de %s', _quando)
         else format('Encontrado no inventário de %s', _quando) end
  from public.patrimonio_bens b
  left join public.patrimonio_leituras l on l.inventario_id = _inventario and l.bem_id = b.id
  where b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito');

  select coalesce(jsonb_agg(b.id order by b.tombamento), '[]'::jsonb) into _nao_encontrados
  from public.patrimonio_bens b
  where b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito')
    and not exists (select 1 from public.patrimonio_leituras l
                    where l.inventario_id = _inventario and l.bem_id = b.id);

  update public.patrimonio_inventarios
  set fechado_em = now(), fechado_por_nome = public.patrimonio_nome_usuario()
  where id = _inventario;

  -- Mesma conta da tela (resumoInventario): só os bens que ainda deviam estar na empresa.
  return jsonb_build_object(
    'encontrados', (select count(*) from public.patrimonio_leituras l join public.patrimonio_bens b on b.id = l.bem_id
                    where l.inventario_id = _inventario and not l.fora_da_empresa
                      and b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito')),
    'nao_encontrados', _nao_encontrados,
    'com_defeito', (select count(*) from public.patrimonio_leituras l join public.patrimonio_bens b on b.id = l.bem_id
                    where l.inventario_id = _inventario and l.com_defeito and not l.fora_da_empresa
                      and b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito')),
    'fora_da_empresa', (select count(*) from public.patrimonio_leituras where inventario_id = _inventario and fora_da_empresa)
  );
end $$;

revoke execute on function public.patrimonio_abrir_inventario(uuid) from public, anon;
revoke execute on function public.patrimonio_inventario_aberto(uuid) from public, anon;
revoke execute on function public.patrimonio_ler(uuid, bigint) from public, anon;
revoke execute on function public.patrimonio_marcar_defeito(uuid, uuid, boolean) from public, anon;
revoke execute on function public.patrimonio_sem_etiqueta(uuid, uuid) from public, anon;
revoke execute on function public.patrimonio_fechar_inventario(uuid) from public, anon;
grant execute on function public.patrimonio_abrir_inventario(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_inventario_aberto(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_ler(uuid, bigint) to authenticated, service_role;
grant execute on function public.patrimonio_marcar_defeito(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.patrimonio_sem_etiqueta(uuid, uuid) to authenticated, service_role;
grant execute on function public.patrimonio_fechar_inventario(uuid) to authenticated, service_role;
