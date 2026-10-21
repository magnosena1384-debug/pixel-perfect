-- Resultado do painel de vendas já somado por dia: o painel só soma os dias do período, em vez de
-- recalcular sobre os ~150 mil itens do mês. É refeito para os dias importados por
-- webposto_consolidar_vendas. `vendas` (cupons) soma entre dias porque cada cupom tem um dia só.
create table public.webposto_vendas_resumo (
  data_ref date not null,
  nivel text not null,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  empresa_codigo integer not null,
  funcionario text,
  hora integer,
  tipo text,
  produto text,
  total numeric not null,
  litros numeric not null,
  vendas bigint not null
);
create index webposto_vendas_resumo_periodo on public.webposto_vendas_resumo(unidade_id, data_ref);

grant select on public.webposto_vendas_resumo to authenticated;
grant all on public.webposto_vendas_resumo to service_role;
alter table public.webposto_vendas_resumo enable row level security;
create policy "admin le resumo de vendas webposto" on public.webposto_vendas_resumo for select to authenticated
using (public.has_role(auth.uid(),'admin'));

create or replace function public.webposto_consolidar_vendas(_de date, _ate date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente administradores podem usar a integração do webPosto.';
  end if;
  update public.webposto_vendas_itens i
  set funcionario = c.dados->>'funcionarioCodigo',
      hora = case when c.dados->>'dataHora' ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}'
        then substring(c.dados->>'dataHora', 12, 2)::integer end,
      cancelada = coalesce(c.dados->>'cancelada', 'N') = 'S'
  from public.webposto_registros c
  where c.endpoint = 'VENDAS'
    and c.codigo = i.empresa_codigo::text || ':' || i.venda_codigo::text
    and i.data_ref between _de and _ate;
  get diagnostics n = row_count;

  delete from public.webposto_vendas_resumo where data_ref between _de and _ate;
  insert into public.webposto_vendas_resumo
    (data_ref, nivel, unidade_id, empresa_codigo, funcionario, hora, tipo, produto, total, litros, vendas)
  select
    data_ref,
    case when grouping(tipo) = 1 then 'geral'
         when grouping(produto) = 1 then 'tipo'
         else 'produto' end,
    unidade_id, empresa_codigo, funcionario, hora, tipo, produto,
    sum(total), sum(litros), count(distinct venda_codigo)
  from (
    select i.data_ref, i.unidade_id, i.empresa_codigo, i.venda_codigo, i.funcionario, i.hora,
      case when i.bico then 'combustivel' else 'produtos' end as tipo,
      i.produto, i.total,
      case when i.bico then i.quantidade else 0 end as litros
    from public.webposto_vendas_itens i
    where i.data_ref between _de and _ate and i.unidade_id is not null and not i.cancelada
  ) itens
  group by data_ref, grouping sets (
    (unidade_id, empresa_codigo, funcionario, hora),
    (unidade_id, empresa_codigo, funcionario, hora, tipo),
    (unidade_id, empresa_codigo, funcionario, tipo, produto)
  );
  return n;
end;
$$;
revoke execute on function public.webposto_consolidar_vendas(date, date) from public, anon;
grant execute on function public.webposto_consolidar_vendas(date, date) to authenticated, service_role;

create or replace function public.painel_vendas_webposto(_de date, _ate date)
returns table (
  nivel text,
  unidade_id uuid,
  colaborador text,
  hora integer,
  tipo text,
  produto text,
  total numeric,
  litros numeric,
  vendas bigint
)
language sql stable security definer set search_path = public
as $$
  with permitidas as (
    select u.id from public.unidades u where public.pode_gestao(auth.uid(), u.id, 'vendas')
  ),
  celulas as (
    select r.nivel, r.unidade_id, r.empresa_codigo, r.funcionario, r.hora, r.tipo, r.produto,
      sum(r.total) as total, sum(r.litros) as litros, sum(r.vendas) as vendas
    from public.webposto_vendas_resumo r
    where r.unidade_id in (select id from permitidas)
      and r.data_ref between _de and _ate
    group by r.nivel, r.unidade_id, r.empresa_codigo, r.funcionario, r.hora, r.tipo, r.produto
  ),
  nomes as (
    select distinct on (f.dados->>'funcionarioCodigo', f.empresa_codigo)
      f.dados->>'funcionarioCodigo' as funcionario, f.empresa_codigo, f.dados->>'nome' as nome
    from public.webposto_registros f
    where f.endpoint = 'FUNCIONARIOS' and nullif(trim(f.dados->>'nome'), '') is not null
  ),
  nomes_qualquer as (
    select distinct on (funcionario) funcionario, nome from nomes order by funcionario
  )
  select
    c.nivel,
    c.unidade_id,
    coalesce(n.nome, q.nome, 'Funcionário ' || c.funcionario, 'Sem colaborador'),
    c.hora, c.tipo, c.produto, c.total, c.litros, c.vendas
  from celulas c
  left join nomes n on n.funcionario = c.funcionario and n.empresa_codigo is not distinct from c.empresa_codigo
  left join nomes_qualquer q on q.funcionario = c.funcionario
$$;

revoke execute on function public.painel_vendas_webposto(date, date) from public, anon;
grant execute on function public.painel_vendas_webposto(date, date) to authenticated, service_role;
