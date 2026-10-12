-- Unidades da rede.
create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem integer not null default 0
);
insert into public.unidades (nome, ordem) values
  ('Posto Lemon I - Satélite', 1),
  ('Posto Lemon II - Neópolis', 2),
  ('Posto Lemon III - Av.9', 3),
  ('Posto Lemon IV - Carrasco', 4),
  ('Posto Lemon V - Nevaldo/Tororos', 5),
  ('Posto Lemon VI - Km.6', 6),
  ('Posto Lemon VII - Alecrim', 7),
  ('Posto Lemon VIII - Gancho', 8),
  ('Posto Lemon IX - Alexandrino', 9),
  ('Escritório Central', 10);

-- Quais módulos da gestão cada usuário acessa em cada unidade.
-- Módulos: vendas, rotinas, pedidos, documentos (regulação), manutencao.
create table public.gestao_acessos (
  user_id uuid not null references auth.users(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  modulos text[] not null default '{}',
  primary key (user_id, unidade_id)
);

-- Registros da gestão (antes ficavam no navegador). Um registro por item de cada coleção.
create table public.gestao_itens (
  id text not null,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colecao text not null check (colecao in ('vendas','rotinas','pedidos','documentos','manutencao')),
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null default auth.uid(),
  primary key (unidade_id, colecao, id)
);

create or replace function public.pode_gestao(_user_id uuid, _unidade_id uuid, _modulo text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_role(_user_id,'admin')
    or exists (select 1 from public.gestao_acessos
               where user_id=_user_id and unidade_id=_unidade_id and _modulo = any(modulos))
$$;

grant select, insert, update, delete on public.unidades, public.gestao_acessos, public.gestao_itens to authenticated;
grant all on public.unidades, public.gestao_acessos, public.gestao_itens to service_role;
alter table public.unidades enable row level security;
alter table public.gestao_acessos enable row level security;
alter table public.gestao_itens enable row level security;

create policy "ver unidades com acesso" on public.unidades for select to authenticated
using (public.has_role(auth.uid(),'admin')
       or exists (select 1 from public.gestao_acessos a where a.unidade_id = unidades.id and a.user_id=auth.uid() and cardinality(a.modulos) > 0));
create policy "admin gerencia unidades" on public.unidades for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "ver proprios acessos ou admin" on public.gestao_acessos for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin gerencia acessos" on public.gestao_acessos for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "ler itens com acesso" on public.gestao_itens for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, colecao));
create policy "inserir itens com acesso" on public.gestao_itens for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, colecao));
create policy "alterar itens com acesso" on public.gestao_itens for update to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, colecao))
with check (public.pode_gestao(auth.uid(), unidade_id, colecao));
create policy "excluir itens com acesso" on public.gestao_itens for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, colecao));
