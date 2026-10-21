-- Itens das vendas do webPosto (VENDAS/ITENS), guardados só com o que o painel usa. O cupom
-- (VENDAS) vem sem itens; hora, vendedor e cancelamento continuam vindo dele.
create table public.webposto_vendas_itens (
  empresa_codigo integer not null,
  item_codigo bigint not null,
  venda_codigo bigint not null,
  unidade_id uuid references public.unidades(id) on delete set null,
  data_ref date not null,
  produto text not null,
  bico boolean not null default false,
  quantidade numeric not null default 0,
  total numeric not null default 0,
  importado_em timestamptz not null default now(),
  primary key (empresa_codigo, item_codigo)
);
create index webposto_vendas_itens_periodo on public.webposto_vendas_itens(unidade_id, data_ref);
create index webposto_vendas_itens_venda on public.webposto_vendas_itens(empresa_codigo, venda_codigo);

grant select, insert, update, delete on public.webposto_vendas_itens to authenticated;
grant all on public.webposto_vendas_itens to service_role;
alter table public.webposto_vendas_itens enable row level security;
create policy "admin gerencia itens webposto" on public.webposto_vendas_itens for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- O tipo de retorno não muda, mas o corpo sim: agora soma os itens (tabela compacta, com índice)
-- em vez de abrir o JSON de cada cupom. Produto não leva a hora (o painel não usa), o que
-- mantém o resultado pequeno.
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
      c.dados->>'funcionarioCodigo' as funcionario,
      case when c.dados->>'dataHora' ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}'
        then substring(c.dados->>'dataHora', 12, 2)::integer end as hora,
      -- Item com bico é combustível; o resto é loja/conveniência/lubrificantes.
      case when i.bico then 'combustivel' else 'produtos' end as tipo,
      i.produto,
      i.total,
      case when i.bico then i.quantidade else 0 end as litros
    from public.webposto_vendas_itens i
    join public.webposto_registros c
      on c.endpoint = 'VENDAS' and c.codigo = i.empresa_codigo::text || ':' || i.venda_codigo::text
    where i.unidade_id in (select id from permitidas)
      and i.data_ref between _de and _ate
      and coalesce(c.dados->>'cancelada', 'N') <> 'S'
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
