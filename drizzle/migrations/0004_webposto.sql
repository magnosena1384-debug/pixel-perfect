-- Integração com a API do webPosto (Quality Automação).
-- A chave da API fica no segredo WEBPOSTO_CHAVE do servidor, nunca no banco.

-- Código da empresa (filial) no webPosto de cada unidade.
alter table public.unidades add column webposto_empresa integer unique;

-- Registros importados, guardados como vieram da API.
create table public.webposto_registros (
  endpoint text not null,
  codigo text not null,
  empresa_codigo integer,
  unidade_id uuid references public.unidades(id) on delete set null,
  data_ref text,
  dados jsonb not null,
  importado_em timestamptz not null default now(),
  primary key (endpoint, codigo)
);
create index webposto_registros_unidade on public.webposto_registros(unidade_id, endpoint, data_ref);

-- Histórico das importações.
create table public.webposto_importacoes (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  data_inicial date not null,
  data_final date not null,
  quantidade integer not null default 0,
  sem_unidade integer not null default 0,
  erro text,
  feito_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.webposto_registros, public.webposto_importacoes to authenticated;
grant all on public.webposto_registros, public.webposto_importacoes to service_role;
alter table public.webposto_registros enable row level security;
alter table public.webposto_importacoes enable row level security;

create policy "admin gerencia registros webposto" on public.webposto_registros for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin gerencia importacoes webposto" on public.webposto_importacoes for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
