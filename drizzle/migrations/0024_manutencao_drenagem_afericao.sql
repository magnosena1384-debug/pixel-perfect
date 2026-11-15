-- Drenagem de tanque Diesel e aferição de bombas e bicos (aba da Manutenção e inspeção).
-- Cada lançamento é uma linha; quem tem o módulo Manutenção ("manutencao") na unidade lê e grava
-- os da unidade, ninguém mais. origem_id guarda o id do registro no Posto Seguro, para a
-- importação não duplicar.
create table public.manutencao_drenagens (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  origem_id text,
  data date not null,
  tanque text not null,
  produto text not null,
  capacidade_litros integer,
  volume_amostra_litros numeric,
  volume_agua_litros numeric,
  tem_agua boolean not null default false,
  aspecto_normal boolean,
  cor text,
  medida_adotada text,
  responsavel text,
  rg_responsavel text,
  dados_origem jsonb,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create unique index manutencao_drenagens_origem on public.manutencao_drenagens (unidade_id, origem_id)
  where origem_id is not null;
create index manutencao_drenagens_busca on public.manutencao_drenagens (unidade_id, data desc);

create table public.manutencao_afericoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  origem_id text,
  data date not null,
  bomba text not null,
  bico text not null,
  produto text not null,
  responsavel text,
  obs text,
  dados_origem jsonb,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create unique index manutencao_afericoes_origem on public.manutencao_afericoes (unidade_id, origem_id)
  where origem_id is not null;
create index manutencao_afericoes_busca on public.manutencao_afericoes (unidade_id, data desc);

grant select, insert, update, delete on public.manutencao_drenagens, public.manutencao_afericoes to authenticated;
grant all on public.manutencao_drenagens, public.manutencao_afericoes to service_role;
alter table public.manutencao_drenagens enable row level security;
alter table public.manutencao_afericoes enable row level security;

create policy "manutencao gerencia drenagens" on public.manutencao_drenagens for all to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'manutencao'))
with check (public.pode_gestao(auth.uid(), unidade_id, 'manutencao'));

create policy "manutencao gerencia afericoes" on public.manutencao_afericoes for all to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'manutencao'))
with check (public.pode_gestao(auth.uid(), unidade_id, 'manutencao'));
