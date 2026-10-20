-- Patrimônio: transferência de bens entre as empresas do grupo, em dois passos.
-- A origem envia (o bem fica "em trânsito" e continua da origem), o destino confirma o
-- recebimento (o bem passa a ser do destino) e a origem pode cancelar enquanto estiver em trânsito.

create table public.patrimonio_transferencias (
  id uuid primary key default gen_random_uuid(),
  bem_id uuid not null references public.patrimonio_bens(id),
  origem_id uuid not null references public.unidades(id),
  destino_id uuid not null references public.unidades(id),
  situacao text not null default 'em_transito'
    check (situacao in ('em_transito', 'recebida', 'cancelada')),
  -- Situação do bem antes de sair (em uso ou com defeito), devolvida ao chegar ou cancelar.
  situacao_bem text not null,
  observacao text not null default '',
  enviado_em timestamptz not null default now(),
  enviado_por_nome text not null default public.patrimonio_nome_usuario(),
  concluido_em timestamptz,
  concluido_por_nome text,
  check (origem_id <> destino_id)
);
create unique index patrimonio_transferencia_aberta on public.patrimonio_transferencias(bem_id)
  where situacao = 'em_transito';
create index patrimonio_transferencias_destino on public.patrimonio_transferencias(destino_id, situacao);
create index patrimonio_transferencias_origem on public.patrimonio_transferencias(origem_id, situacao);

grant select on public.patrimonio_transferencias to authenticated;
grant all on public.patrimonio_transferencias to service_role;
alter table public.patrimonio_transferencias enable row level security;

create policy "patrimonio ver transferencias" on public.patrimonio_transferencias for select
to authenticated
using (public.patrimonio_pode_ver(origem_id) or public.patrimonio_pode_ver(destino_id));

-- O destino também vê o bem enquanto ele está a caminho.
create policy "patrimonio ver bem a receber" on public.patrimonio_bens for select to authenticated
using (exists (
  select 1 from public.patrimonio_transferencias t
  where t.bem_id = patrimonio_bens.id and t.situacao = 'em_transito'
    and public.patrimonio_pode_ver(t.destino_id)
));

create or replace function public.patrimonio_transferir(_bem uuid, _destino uuid, _observacao text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _b public.patrimonio_bens;
  _id uuid;
begin
  select * into _b from public.patrimonio_bens where id = _bem for update;
  if not found or not public.patrimonio_pode_gerenciar(_b.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _b.situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Só bens em uso ou com defeito podem ser transferidos.';
  end if;
  if _destino = _b.unidade_id or not exists (select 1 from public.unidades where id = _destino) then
    raise exception 'Escolha outra empresa do grupo como destino.';
  end if;

  insert into public.patrimonio_transferencias (bem_id, origem_id, destino_id, situacao_bem, observacao)
  values (_bem, _b.unidade_id, _destino, _b.situacao, coalesce(trim(_observacao), ''))
  returning id into _id;
  update public.patrimonio_bens set situacao = 'em_transito' where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'transferencia_envio', format('Para %s', (select nome from public.unidades where id = _destino)));
  return _id;
end $$;

-- Só quem tem Patrimônio na empresa de destino confirma o recebimento.
create or replace function public.patrimonio_receber(_transferencia uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _t public.patrimonio_transferencias;
begin
  select * into _t from public.patrimonio_transferencias where id = _transferencia for update;
  if not found or not public.patrimonio_pode_ver(_t.destino_id) then
    raise exception 'Só a empresa de destino confirma o recebimento.';
  end if;
  if _t.situacao <> 'em_transito' then
    raise exception 'Esta transferência não está mais em trânsito.';
  end if;
  update public.patrimonio_transferencias
  set situacao = 'recebida', concluido_em = now(), concluido_por_nome = public.patrimonio_nome_usuario()
  where id = _transferencia;
  update public.patrimonio_bens
  set unidade_id = _t.destino_id, situacao = _t.situacao_bem
  where id = _t.bem_id;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_t.bem_id, 'transferencia_recebida', format('De %s para %s',
    (select nome from public.unidades where id = _t.origem_id),
    (select nome from public.unidades where id = _t.destino_id)));
end $$;

-- Só quem gerencia a origem cancela, enquanto estiver em trânsito; o bem volta como estava.
create or replace function public.patrimonio_cancelar_transferencia(_transferencia uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _t public.patrimonio_transferencias;
begin
  select * into _t from public.patrimonio_transferencias where id = _transferencia for update;
  if not found or not public.patrimonio_pode_gerenciar(_t.origem_id) then
    raise exception 'Só quem gerencia a empresa de origem cancela a transferência.';
  end if;
  if _t.situacao <> 'em_transito' then
    raise exception 'Esta transferência não está mais em trânsito.';
  end if;
  update public.patrimonio_transferencias
  set situacao = 'cancelada', concluido_em = now(), concluido_por_nome = public.patrimonio_nome_usuario()
  where id = _transferencia;
  update public.patrimonio_bens set situacao = _t.situacao_bem where id = _t.bem_id;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_t.bem_id, 'transferencia_cancelada',
    format('Ia para %s', (select nome from public.unidades where id = _t.destino_id)));
end $$;

-- Nomes de todas as empresas do grupo (destino da transferência e nomes nas listas), para quem
-- tem Patrimônio em alguma empresa. Só id e nome.
create or replace function public.patrimonio_empresas_do_grupo()
returns table (id uuid, nome text)
language sql stable security definer set search_path = public
as $fn$
  select u.id, u.nome from public.unidades u
  where exists (select 1 from public.unidades x where public.patrimonio_pode_ver(x.id))
  order by u.ordem, u.nome
$fn$;

revoke execute on function public.patrimonio_transferir(uuid, uuid, text) from public, anon;
revoke execute on function public.patrimonio_receber(uuid) from public, anon;
revoke execute on function public.patrimonio_cancelar_transferencia(uuid) from public, anon;
revoke execute on function public.patrimonio_empresas_do_grupo() from public, anon;
grant execute on function public.patrimonio_empresas_do_grupo() to authenticated, service_role;
grant execute on function public.patrimonio_transferir(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.patrimonio_receber(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_cancelar_transferencia(uuid) to authenticated, service_role;
