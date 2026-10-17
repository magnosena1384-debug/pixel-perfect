-- Gerado por scripts/gerar-instalacao-banco.mjs a partir de drizzle/migrations. Não edite à mão.
-- Rode uma única vez, num projeto Supabase novo, no SQL Editor.

-- ===== 0000_migration =====
create type public.app_role as enum ('admin','moderator','user');
create type public.course_status as enum ('rascunho','publicado');
create type public.enrollment_status as enum ('ativa','revogada','expirada');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles or admin" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "read own or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, nome, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', ''), coalesce(new.email,''), new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  descricao_curta text not null default '',
  descricao text not null default '',
  capa_url text,
  preco_centavos integer not null default 0,
  status course_status not null default 'rascunho',
  created_at timestamptz not null default now()
);
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  titulo text not null,
  ordem integer not null default 0
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  video_path text,
  duracao_seg integer not null default 0,
  ordem integer not null default 0,
  is_preview boolean not null default false
);
create table public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  tipo text not null default 'link' check (tipo in ('arquivo','link')),
  titulo text not null,
  url text not null,
  ordem integer not null default 0
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  origem text not null default 'manual',
  status enrollment_status not null default 'ativa',
  inicio timestamptz not null default now(),
  fim timestamptz,
  unique(user_id, course_id)
);
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  posicao_seg integer not null default 0,
  concluida boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique(user_id, lesson_id)
);

grant select on public.courses, public.modules, public.lessons to anon;
grant select, insert, update, delete on public.courses, public.modules, public.lessons, public.lesson_assets, public.enrollments, public.lesson_progress to authenticated;
grant all on public.courses, public.modules, public.lessons, public.lesson_assets, public.enrollments, public.lesson_progress to service_role;

alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_assets enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

create or replace function public.has_active_enrollment(_user_id uuid, _course_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.enrollments where user_id=_user_id and course_id=_course_id and status='ativa' and (fim is null or fim > now())) $$;

create or replace function public.lesson_course_id(_lesson_id uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select m.course_id from public.lessons l join public.modules m on m.id=l.module_id where l.id=_lesson_id $$;

create or replace function public.can_access_lesson(_user_id uuid, _lesson_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_role(_user_id,'admin')
    or exists (select 1 from public.lessons where id=_lesson_id and is_preview)
    or public.has_active_enrollment(_user_id, public.lesson_course_id(_lesson_id))
$$;

create policy "public read published courses" on public.courses for select to anon, authenticated
using (status='publicado' or public.has_role(auth.uid(),'admin'));
create policy "admin write courses" on public.courses for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public read modules" on public.modules for select to anon, authenticated
using (exists (select 1 from public.courses c where c.id=course_id and (c.status='publicado' or public.has_role(auth.uid(),'admin'))));
create policy "admin write modules" on public.modules for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public read lessons" on public.lessons for select to anon, authenticated
using (exists (select 1 from public.modules m join public.courses c on c.id=m.course_id where m.id=module_id and (c.status='publicado' or public.has_role(auth.uid(),'admin'))));
create policy "admin write lessons" on public.lessons for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read assets with access" on public.lesson_assets for select to authenticated
using (public.can_access_lesson(auth.uid(), lesson_id));
create policy "admin write assets" on public.lesson_assets for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read own enrollments" on public.enrollments for select to authenticated
using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin write enrollments" on public.enrollments for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "own progress read" on public.lesson_progress for select to authenticated
using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own progress insert" on public.lesson_progress for insert to authenticated
with check (user_id=auth.uid() and public.can_access_lesson(auth.uid(), lesson_id));
create policy "own progress update" on public.lesson_progress for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy "capas read" on storage.objects for select to anon, authenticated using (bucket_id='capas');
create policy "admin manage media" on storage.objects for all to authenticated
using (bucket_id in ('capas','videos','materiais') and public.has_role(auth.uid(),'admin'))
with check (bucket_id in ('capas','videos','materiais') and public.has_role(auth.uid(),'admin'));
create policy "lesson media read with access" on storage.objects for select to authenticated
using (bucket_id in ('videos','materiais') and public.can_access_lesson(auth.uid(), ((storage.foldername(name))[1])::uuid));

with c as (
  insert into public.courses (slug,titulo,descricao_curta,descricao,preco_centavos,status)
  values ('operacao-de-pista','Operação de Pista','Padrões de atendimento e segurança na pista Lemon.','Curso completo sobre atendimento, abastecimento seguro e rotinas operacionais dos postos Lemon.',19700,'publicado')
  returning id
), m1 as (insert into public.modules (course_id,titulo,ordem) select id,'Boas-vindas',1 from c returning id),
m2 as (insert into public.modules (course_id,titulo,ordem) select id,'Segurança na pista',2 from c returning id)
insert into public.lessons (module_id,titulo,descricao,duracao_seg,ordem,is_preview)
select id,'Apresentação do curso','Conheça a Lemon e o que você vai aprender.',300,1,true from m1
union all select id,'Padrão de atendimento','Como receber o cliente na pista.',600,2,false from m1
union all select id,'Abastecimento seguro','Procedimentos de segurança durante o abastecimento.',720,1,false from m2
union all select id,'Emergências','O que fazer em caso de vazamento ou incêndio.',540,2,false from m2;

-- ===== 0001_duvidas_aulas =====
-- Conteúdo de apoio da aula usado pela IA (transcrição, resumo, procedimentos).
-- Fica fora de public.lessons porque lessons é legível por anônimos.
create table public.lesson_transcripts (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  texto text not null default '',
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.lesson_transcripts to authenticated;
grant all on public.lesson_transcripts to service_role;
alter table public.lesson_transcripts enable row level security;
create policy "read transcript with access" on public.lesson_transcripts for select to authenticated
using (public.can_access_lesson(auth.uid(), lesson_id));
create policy "admin write transcripts" on public.lesson_transcripts for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Dúvidas dos alunos sobre uma aula, com a resposta gerada pela IA.
create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  pergunta text not null check (char_length(pergunta) between 3 and 1000),
  resposta text not null default '',
  created_at timestamptz not null default now()
);
create index lesson_questions_user_lesson on public.lesson_questions(user_id, lesson_id, created_at desc);
grant select, insert on public.lesson_questions to authenticated;
grant all on public.lesson_questions to service_role;
alter table public.lesson_questions enable row level security;
create policy "read own questions or admin" on public.lesson_questions for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "ask on accessible lesson" on public.lesson_questions for insert to authenticated
with check (user_id = auth.uid() and public.can_access_lesson(auth.uid(), lesson_id));

-- ===== 0002_gestao_unidades_acessos =====
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

-- ===== 0003_aplicar_pendentes =====
comment on table public.lessons is 'Aulas dos cursos';

-- ===== 0004_webposto =====
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

-- ===== 0005_storage_buckets =====
-- Pastas de arquivos do Supabase Storage usadas pelo sistema.
-- capas: imagens públicas dos cursos. videos e materiais: privados, liberados por aula
-- (políticas na migração 0000).
insert into storage.buckets (id, name, public)
values ('capas', 'capas', true), ('videos', 'videos', false), ('materiais', 'materiais', false)
on conflict (id) do nothing;

-- ===== 0006_restringe_funcoes =====
-- Fecha funções internas que não precisam ser chamadas pela API (alerta do Supabase Advisor).
-- handle_new_user só roda como gatilho de cadastro.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Visitantes sem login só precisam de has_role (usada nas regras do catálogo público).
revoke execute on function public.can_access_lesson(uuid, uuid) from public, anon;
revoke execute on function public.has_active_enrollment(uuid, uuid) from public, anon;
revoke execute on function public.lesson_course_id(uuid) from public, anon;
revoke execute on function public.pode_gestao(uuid, uuid, text) from public, anon;
grant execute on function public.can_access_lesson(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_active_enrollment(uuid, uuid) to authenticated, service_role;
grant execute on function public.lesson_course_id(uuid) to authenticated, service_role;
grant execute on function public.pode_gestao(uuid, uuid, text) to authenticated, service_role;
