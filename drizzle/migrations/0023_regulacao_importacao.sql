-- Fila da importação dos documentos do Posto Seguro para a Regulação. Cada linha é um documento
-- já montado; a função do Supabase "importar-regulacao" baixa o PDF, guarda no espaço de
-- arquivos e cria o documento. Só quem administra o banco e essa função mexem na fila.
create table public.regulacao_importacao (
  id text primary key,                 -- id do documento no Posto Seguro
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  doc jsonb not null,                  -- documento da Regulação, sem o arquivo
  arquivo_url text,
  arquivo_nome text,
  estado text not null default 'pendente' check (estado in ('pendente', 'fazendo', 'feito', 'erro')),
  erro text,
  atualizado_em timestamptz not null default now()
);
alter table public.regulacao_importacao enable row level security;
revoke all on public.regulacao_importacao from anon, authenticated;
grant all on public.regulacao_importacao to service_role;

-- Pega até _n linhas pendentes (ou paradas em "fazendo" há mais de 10 minutos) e as marca como
-- em andamento. Chamadas ao mesmo tempo não pegam a mesma linha.
create or replace function public.regulacao_importacao_pegar(_n integer)
returns setof public.regulacao_importacao
language sql
security definer
set search_path = public
as $$
  update public.regulacao_importacao r
  set estado = 'fazendo', atualizado_em = now()
  where r.id in (
    select id from public.regulacao_importacao
    where estado = 'pendente' or (estado = 'fazendo' and atualizado_em < now() - interval '10 minutes')
    order by id
    limit greatest(_n, 0)
    for update skip locked
  )
  returning r.*
$$;
revoke execute on function public.regulacao_importacao_pegar(integer) from public, anon, authenticated;
grant execute on function public.regulacao_importacao_pegar(integer) to service_role;
