-- O painel de vendas ficava lento por abrir o JSON de cada cupom a cada consulta. Hora, vendedor
-- e cancelamento passam a ser gravados no próprio item (uma vez, depois de cada importação) e o
-- painel lê só a tabela compacta.
alter table public.webposto_vendas_itens
  add column funcionario text,
  add column hora integer,
  add column cancelada boolean not null default false;

-- Copia do cupom (VENDAS) para os itens do período. Roda depois de importar cupons ou itens.
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
  itens as (
    select
      i.unidade_id,
      i.empresa_codigo,
      i.venda_codigo,
      i.funcionario,
      i.hora,
      -- Item com bico é combustível; o resto é loja/conveniência/lubrificantes.
      case when i.bico then 'combustivel' else 'produtos' end as tipo,
      i.produto,
      i.total,
      case when i.bico then i.quantidade else 0 end as litros
    from public.webposto_vendas_itens i
    where i.unidade_id in (select id from permitidas)
      and i.data_ref between _de and _ate
      and not i.cancelada
  ),
  celulas as (
    select
      case when grouping(tipo) = 1 then 'geral'
           when grouping(produto) = 1 then 'tipo'
           else 'produto' end as nivel,
      unidade_id, empresa_codigo, funcionario, hora, tipo, produto,
      sum(total) as total, sum(litros) as litros, count(distinct venda_codigo) as vendas
    from itens
    group by grouping sets (
      (unidade_id, empresa_codigo, funcionario, hora),
      (unidade_id, empresa_codigo, funcionario, hora, tipo),
      (unidade_id, empresa_codigo, funcionario, tipo, produto)
    )
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
