-- RH: vendas do webPosto por funcionário, para o ticket médio na tabela por colaborador.
-- Soma os cupons de VENDAS (sem os cancelados) por unidade e funcionário, com o nome e o CPF
-- do cadastro FUNCIONARIOS. Só as unidades em que quem chama tem RH; nenhum outro dado pessoal.
create or replace function public.rh_ticket_vendas(_de date, _ate date)
returns table (unidade_id uuid, cpf text, nome text, total numeric, cupons bigint)
language sql stable security definer set search_path = public
as $$
  with permitidas as (
    select u.id from public.unidades u
    where public.pode_gestao(auth.uid(), u.id, 'rh')
       or public.pode_gestao(auth.uid(), u.id, 'rh-importar')
  ),
  cupons as (
    select r.unidade_id, r.empresa_codigo, r.dados->>'funcionarioCodigo' as funcionario,
      coalesce((r.dados->>'totalVenda')::numeric, 0) as total
    from public.webposto_registros r
    where r.endpoint = 'VENDAS'
      and r.unidade_id in (select id from permitidas)
      and r.data_ref between _de::text and _ate::text
      and coalesce(r.dados->>'cancelada', 'N') <> 'S'
      and r.dados->>'funcionarioCodigo' is not null
  ),
  somas as (
    select c.unidade_id, c.empresa_codigo, c.funcionario, sum(c.total) as total, count(*) as cupons
    from cupons c
    group by c.unidade_id, c.empresa_codigo, c.funcionario
  )
  select s.unidade_id, f.cpf, coalesce(f.nome, 'Funcionário ' || s.funcionario), s.total, s.cupons
  from somas s
  left join lateral (
    select nullif(trim(x.dados->>'cpf'), '') as cpf, nullif(trim(x.dados->>'nome'), '') as nome
    from public.webposto_registros x
    where x.endpoint = 'FUNCIONARIOS' and x.dados->>'funcionarioCodigo' = s.funcionario
    order by (x.empresa_codigo is not distinct from s.empresa_codigo) desc
    limit 1
  ) f on true
$$;

revoke execute on function public.rh_ticket_vendas(date, date) from public, anon;
grant execute on function public.rh_ticket_vendas(date, date) to authenticated, service_role;
