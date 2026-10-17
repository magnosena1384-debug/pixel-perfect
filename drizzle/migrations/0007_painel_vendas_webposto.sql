-- Dashboard de vendas da gestão a partir dos cupons importados do webPosto (endpoint VENDAS).
-- Devolve só agregados por unidade, colaborador, hora, tipo e produto (nada de CPF, cliente
-- etc.), e só das unidades em que o usuário pode ver Vendas. Cupons cancelados ficam de fora.
-- `vendas` é o número de cupons distintos; como cada cupom tem uma única unidade, colaborador e
-- hora, essa contagem pode ser somada entre linhas do mesmo nível e tipo.
-- Níveis: 'geral' (cupom inteiro), 'tipo' (combustivel/produtos) e 'produto'.
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
  cupons as (
    select r.unidade_id, r.empresa_codigo, r.codigo, r.dados
    from public.webposto_registros r
    where r.endpoint = 'VENDAS'
      and r.unidade_id in (select id from permitidas)
      and r.data_ref between _de::text and _ate::text
      and coalesce(r.dados->>'cancelada', 'N') <> 'S'
  ),
  itens as (
    select
      c.unidade_id,
      c.empresa_codigo,
      c.codigo,
      c.dados->>'funcionarioCodigo' as funcionario,
      case when c.dados->>'dataHora' ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}'
        then substring(c.dados->>'dataHora', 12, 2)::integer end as hora,
      -- Item com bico é combustível; o resto é loja/conveniência/lubrificantes.
      case when i->>'bicoCodigo' is not null then 'combustivel' else 'produtos' end as tipo,
      coalesce(nullif(trim(i->>'produtoDescricao'), ''), 'Produto ' || (i->>'produtoCodigo')) as produto,
      coalesce((i->>'totalVenda')::numeric, 0) as total,
      case when i->>'bicoCodigo' is not null
        then coalesce((i->>'quantidade')::numeric, 0) else 0 end as litros
    from cupons c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c.dados->'itens') = 'array' then c.dados->'itens' else '[]'::jsonb end
    ) i
  ),
  celulas as (
    select
      case when grouping(tipo) = 1 then 'geral'
           when grouping(produto) = 1 then 'tipo'
           else 'produto' end as nivel,
      unidade_id, empresa_codigo, funcionario, hora, tipo, produto,
      sum(total) as total, sum(litros) as litros, count(distinct codigo) as vendas
    from itens
    group by grouping sets (
      (unidade_id, empresa_codigo, funcionario, hora),
      (unidade_id, empresa_codigo, funcionario, hora, tipo),
      (unidade_id, empresa_codigo, funcionario, hora, tipo, produto)
    )
  ),
  nomes as (
    select distinct on (f.dados->>'funcionarioCodigo', f.empresa_codigo)
      f.dados->>'funcionarioCodigo' as funcionario, f.empresa_codigo, f.dados->>'nome' as nome
    from public.webposto_registros f
    where f.endpoint = 'FUNCIONARIOS' and nullif(trim(f.dados->>'nome'), '') is not null
  )
  select
    c.nivel,
    c.unidade_id,
    coalesce(
      (select n.nome from nomes n
       where n.funcionario = c.funcionario
       order by (n.empresa_codigo is not distinct from c.empresa_codigo) desc
       limit 1),
      'Funcionário ' || c.funcionario,
      'Sem colaborador'
    ),
    c.hora, c.tipo, c.produto, c.total, c.litros, c.vendas
  from celulas c
$$;

revoke execute on function public.painel_vendas_webposto(date, date) from public, anon;
grant execute on function public.painel_vendas_webposto(date, date) to authenticated, service_role;
