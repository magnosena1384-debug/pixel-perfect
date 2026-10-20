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

-- ===== 0007_painel_vendas_webposto =====
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

-- ===== 0008_rh_ponto =====
-- RH: ponto diário importado do "Relatório de Frequência Analítico" do QuarkRH.
-- Permissões por unidade em gestao_acessos.modulos: 'rh' (ver) e 'rh-importar' (gravar).
-- A gravação só acontece pela função rh_gravar_ponto, que troca o período inteiro de uma vez.

create table public.rh_importacoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  relatorio text not null check (relatorio in ('frequencia', 'irregularidades', 'banco_horas')),
  arquivo text not null,
  periodo_de date,
  periodo_ate date,
  quantidade integer not null default 0,
  feito_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index rh_importacoes_unidade on public.rh_importacoes(unidade_id, criado_em desc);

create table public.rh_ponto_dias (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado (sem acento, maiúsculo)
  nome text not null,
  data date not null,
  jornada text not null default '',
  batidas text[] not null default '{}',
  diurna_min integer not null default 0,
  noturna_min integer not null default 0,
  extras_min integer not null default 0,
  extras100_min integer not null default 0,
  hn_min integer not null default 0,
  descontos_min integer not null default 0,
  observacao text not null default '',
  folga boolean not null default false,
  trabalhou boolean not null default false,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador, data)
);
create index rh_ponto_dias_data on public.rh_ponto_dias(unidade_id, data);

grant select, insert, delete on public.rh_importacoes, public.rh_ponto_dias to authenticated;
grant all on public.rh_importacoes, public.rh_ponto_dias to service_role;
alter table public.rh_importacoes enable row level security;
alter table public.rh_ponto_dias enable row level security;

create policy "rh ver importacoes" on public.rh_importacoes for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh registrar importacao" on public.rh_importacoes for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

create policy "rh ver ponto" on public.rh_ponto_dias for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar ponto" on public.rh_ponto_dias for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar ponto" on public.rh_ponto_dias for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca os dias de ponto, no período [_de, _ate], das pessoas que vieram no arquivo; tudo ou nada.
-- Roda com as permissões de quem chama (as regras acima continuam valendo).
create or replace function public.rh_gravar_ponto(
  _unidade uuid, _arquivo text, _de date, _ate date, _dias jsonb
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  _importacao uuid;
  _n integer;
begin
  if not public.pode_gestao(auth.uid(), _unidade, 'rh-importar') then
    raise exception 'Você não tem permissão para importar o RH desta unidade.';
  end if;
  select count(*) into _n from jsonb_array_elements(_dias) e
  where (e->>'data')::date between _de and _ate;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'frequencia', _arquivo, _de, _ate, _n)
  returning id into _importacao;

  -- Só troca quem veio no arquivo: um relatório filtrado para uma pessoa não apaga as outras.
  delete from public.rh_ponto_dias
  where unidade_id = _unidade and data between _de and _ate
    and colaborador in (select e->>'colaborador' from jsonb_array_elements(_dias) e);

  insert into public.rh_ponto_dias (
    unidade_id, colaborador, nome, data, jornada, batidas, diurna_min, noturna_min, extras_min,
    extras100_min, hn_min, descontos_min, observacao, folga, trabalhou, importacao_id
  )
  select _unidade, d.colaborador, d.nome, d.data, coalesce(d.jornada, ''),
    coalesce(d.batidas, '{}'), coalesce(d.diurna_min, 0), coalesce(d.noturna_min, 0),
    coalesce(d.extras_min, 0), coalesce(d.extras100_min, 0), coalesce(d.hn_min, 0),
    coalesce(d.descontos_min, 0), coalesce(d.observacao, ''), coalesce(d.folga, false),
    coalesce(d.trabalhou, false), _importacao
  from jsonb_to_recordset(_dias) as d(
    colaborador text, nome text, data date, jornada text, batidas text[], diurna_min integer,
    noturna_min integer, extras_min integer, extras100_min integer, hn_min integer,
    descontos_min integer, observacao text, folga boolean, trabalhou boolean
  )
  where d.data between _de and _ate;
  return _n;
end $$;

revoke execute on function public.rh_gravar_ponto(uuid, text, date, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_ponto(uuid, text, date, date, jsonb) to authenticated, service_role;

-- ===== 0009_rh_irregularidades =====
-- RH: ocorrências do "Relatório de Irregularidades - Completo" do QuarkRH (FALTA, ATRASO, …),
-- uma linha por colaborador, tipo e data. Mesmas permissões do ponto (0008).

create table public.rh_irregularidades (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado, igual ao de rh_ponto_dias
  nome text not null,
  cpf text not null default '',
  cargo text not null default '',
  setor text not null default '',
  vinculo text not null default '',
  tipo text not null,
  data date not null,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador, tipo, data)
);
create index rh_irregularidades_data on public.rh_irregularidades(unidade_id, data);

grant select, insert, delete on public.rh_irregularidades to authenticated;
grant all on public.rh_irregularidades to service_role;
alter table public.rh_irregularidades enable row level security;

create policy "rh ver irregularidades" on public.rh_irregularidades for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar irregularidades" on public.rh_irregularidades for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar irregularidades" on public.rh_irregularidades for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca as ocorrências da unidade no período [_de, _ate] pelas enviadas, tudo ou nada.
create or replace function public.rh_gravar_irregularidades(
  _unidade uuid, _arquivo text, _de date, _ate date, _linhas jsonb
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  _importacao uuid;
  _n integer;
begin
  if not public.pode_gestao(auth.uid(), _unidade, 'rh-importar') then
    raise exception 'Você não tem permissão para importar o RH desta unidade.';
  end if;
  select count(*) into _n from jsonb_array_elements(_linhas) e
  where (e->>'data')::date between _de and _ate;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'irregularidades', _arquivo, _de, _ate, _n)
  returning id into _importacao;

  delete from public.rh_irregularidades where unidade_id = _unidade and data between _de and _ate;

  insert into public.rh_irregularidades (
    unidade_id, colaborador, nome, cpf, cargo, setor, vinculo, tipo, data, importacao_id
  )
  select _unidade, i.colaborador, i.nome, coalesce(i.cpf, ''), coalesce(i.cargo, ''),
    coalesce(i.setor, ''), coalesce(i.vinculo, ''), i.tipo, i.data, _importacao
  from jsonb_to_recordset(_linhas) as i(
    colaborador text, nome text, cpf text, cargo text, setor text, vinculo text, tipo text, data date
  )
  where i.data between _de and _ate;
  return _n;
end $$;

revoke execute on function public.rh_gravar_irregularidades(uuid, text, date, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_irregularidades(uuid, text, date, date, jsonb) to authenticated, service_role;

-- ===== 0010_rh_banco_horas =====
-- RH: saldo do banco de horas por colaborador ("Relatório Sintético - Banco de Horas" do QuarkRH).
-- É uma foto: cada importação troca a foto inteira da unidade. Mesmas permissões do ponto (0008).

create table public.rh_banco_horas (
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  colaborador text not null, -- nome normalizado, igual ao de rh_ponto_dias
  nome text not null,
  setor text not null default '',
  admissao date,
  credito_min integer not null default 0,
  debito_min integer not null default 0,
  saldo_min integer not null default 0,
  referencia date not null,
  importacao_id uuid references public.rh_importacoes(id) on delete set null,
  primary key (unidade_id, colaborador)
);

grant select, insert, delete on public.rh_banco_horas to authenticated;
grant all on public.rh_banco_horas to service_role;
alter table public.rh_banco_horas enable row level security;

create policy "rh ver banco de horas" on public.rh_banco_horas for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh') or public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh gravar banco de horas" on public.rh_banco_horas for insert to authenticated
with check (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));
create policy "rh trocar banco de horas" on public.rh_banco_horas for delete to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'rh-importar'));

-- Troca o banco de horas da unidade pelo enviado, tudo ou nada.
create or replace function public.rh_gravar_banco_horas(
  _unidade uuid, _arquivo text, _referencia date, _linhas jsonb
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  _importacao uuid;
  _n integer := jsonb_array_length(_linhas);
begin
  if not public.pode_gestao(auth.uid(), _unidade, 'rh-importar') then
    raise exception 'Você não tem permissão para importar o RH desta unidade.';
  end if;
  insert into public.rh_importacoes (unidade_id, relatorio, arquivo, periodo_de, periodo_ate, quantidade)
  values (_unidade, 'banco_horas', _arquivo, _referencia, _referencia, _n)
  returning id into _importacao;

  delete from public.rh_banco_horas where unidade_id = _unidade;

  insert into public.rh_banco_horas (
    unidade_id, colaborador, nome, setor, admissao, credito_min, debito_min, saldo_min, referencia,
    importacao_id
  )
  select _unidade, b.colaborador, b.nome, coalesce(b.setor, ''), b.admissao,
    coalesce(b.credito, 0), coalesce(b.debito, 0), coalesce(b.saldo, 0), _referencia, _importacao
  from jsonb_to_recordset(_linhas) as b(
    colaborador text, nome text, setor text, admissao date, credito integer, debito integer,
    saldo integer
  );
  return _n;
end $$;

revoke execute on function public.rh_gravar_banco_horas(uuid, text, date, jsonb) from public, anon;
grant execute on function public.rh_gravar_banco_horas(uuid, text, date, jsonb) to authenticated, service_role;

-- ===== 0011_rh_ticket_vendas =====
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
    -- Só o cadastro da mesma empresa (posto): nunca devolve nome ou CPF de outro posto.
    where x.endpoint = 'FUNCIONARIOS' and x.dados->>'funcionarioCodigo' = s.funcionario
      and x.empresa_codigo is not distinct from s.empresa_codigo
    limit 1
  ) f on true
$$;

revoke execute on function public.rh_ticket_vendas(date, date) from public, anon;
grant execute on function public.rh_ticket_vendas(date, date) to authenticated, service_role;

-- ===== 0012_patrimonio_bens =====
-- Patrimônio: bens com tombamento único no grupo e histórico de cada um.
-- Permissões por empresa em gestao_acessos.modulos: 'patrimonio' (ver) e 'patrimonio-gerenciar'.
-- Ninguém escreve direto nas tabelas: toda escrita passa pelas funções abaixo, que conferem a
-- permissão e gravam o histórico.

-- Nome de quem está agindo, para o histórico (o gerente não lê o perfil de outras pessoas).
create or replace function public.patrimonio_nome_usuario()
returns text language sql stable security definer set search_path = public
as $$ select coalesce((select nome from public.profiles where id = auth.uid()), '') $$;

create table public.patrimonio_bens (
  id uuid primary key default gen_random_uuid(),
  -- Sequência do banco: dois cadastros ao mesmo tempo nunca recebem o mesmo número.
  tombamento bigint generated always as identity unique,
  unidade_id uuid not null references public.unidades(id),
  setor text not null default '',
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null,
  marca text not null default '',
  modelo text not null default '',
  numero_serie text,
  data_compra date not null,
  valor_compra_centavos bigint not null check (valor_compra_centavos >= 0),
  vida_util_anos integer not null check (vida_util_anos between 0 and 100),
  situacao text not null default 'em_uso'
    check (situacao in ('em_uso', 'com_defeito', 'em_transito', 'baixado')),
  baixa_data date,
  baixa_motivo text,
  baixa_obs text,
  reimprimir_etiqueta boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null default auth.uid()
);
create index patrimonio_bens_unidade on public.patrimonio_bens(unidade_id);
create index patrimonio_bens_serie on public.patrimonio_bens(lower(numero_serie));

create table public.patrimonio_historico (
  id bigint generated always as identity primary key,
  bem_id uuid not null references public.patrimonio_bens(id) on delete cascade,
  quando timestamptz not null default now(),
  quem uuid references auth.users(id) on delete set null default auth.uid(),
  -- Nome gravado na hora: o gerente não lê o perfil de outras pessoas.
  quem_nome text not null default public.patrimonio_nome_usuario(),
  evento text not null,
  detalhe text not null default ''
);
create index patrimonio_historico_bem on public.patrimonio_historico(bem_id, quando desc);

grant select on public.patrimonio_bens, public.patrimonio_historico to authenticated;
grant all on public.patrimonio_bens, public.patrimonio_historico to service_role;
alter table public.patrimonio_bens enable row level security;
alter table public.patrimonio_historico enable row level security;

create policy "patrimonio ver bens" on public.patrimonio_bens for select to authenticated
using (public.pode_gestao(auth.uid(), unidade_id, 'patrimonio')
    or public.pode_gestao(auth.uid(), unidade_id, 'patrimonio-gerenciar'));
-- O histórico segue o bem: quem vê o bem vê o histórico dele.
create policy "patrimonio ver historico" on public.patrimonio_historico for select to authenticated
using (exists (select 1 from public.patrimonio_bens b where b.id = bem_id));

create or replace function public.patrimonio_pode_gerenciar(_unidade uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.pode_gestao(auth.uid(), _unidade, 'patrimonio-gerenciar') $$;

-- Cadastra um bem. Se o nº de série já existe num bem não baixado, devolve {repetido: …} sem
-- gravar; com "confirmar_serie_repetida": true, grava mesmo assim.
create or replace function public.patrimonio_cadastrar(_unidade uuid, _dados jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _serie text := nullif(trim(_dados->>'numero_serie'), '');
  _rep record;
  _bem record;
begin
  if not public.patrimonio_pode_gerenciar(_unidade) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _serie is not null and not coalesce((_dados->>'confirmar_serie_repetida')::boolean, false) then
    select b.id, b.tombamento, b.nome, u.nome as empresa into _rep
    from public.patrimonio_bens b join public.unidades u on u.id = b.unidade_id
    where lower(b.numero_serie) = lower(_serie) and b.situacao <> 'baixado'
    limit 1;
    if found then
      return jsonb_build_object('repetido', jsonb_build_object(
        'id', _rep.id, 'tombamento', _rep.tombamento, 'nome', _rep.nome, 'empresa', _rep.empresa));
    end if;
  end if;

  insert into public.patrimonio_bens (
    unidade_id, setor, nome, categoria, marca, modelo, numero_serie, data_compra,
    valor_compra_centavos, vida_util_anos
  ) values (
    _unidade, coalesce(trim(_dados->>'setor'), ''), trim(_dados->>'nome'), _dados->>'categoria',
    coalesce(trim(_dados->>'marca'), ''), coalesce(trim(_dados->>'modelo'), ''), _serie,
    (_dados->>'data_compra')::date, (_dados->>'valor_compra_centavos')::bigint,
    (_dados->>'vida_util_anos')::integer
  ) returning id, tombamento into _bem;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem.id, 'cadastro', (select nome from public.unidades where id = _unidade));
  return jsonb_build_object('id', _bem.id, 'tombamento', _bem.tombamento);
end $$;

-- Edita os dados de um bem. A empresa não muda aqui (só por transferência); bem em trânsito ou
-- baixado não é editado. Situação aceita só 'em_uso' ou 'com_defeito'.
create or replace function public.patrimonio_editar(_id uuid, _dados jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _bem public.patrimonio_bens;
  _situacao text := coalesce(_dados->>'situacao', 'em_uso');
begin
  select * into _bem from public.patrimonio_bens where id = _id for update;
  if not found or not public.patrimonio_pode_gerenciar(_bem.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _bem.situacao in ('em_transito', 'baixado') then
    raise exception 'Bem em trânsito ou baixado não pode ser editado.';
  end if;
  if _situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Situação inválida.';
  end if;

  update public.patrimonio_bens set
    setor = coalesce(trim(_dados->>'setor'), ''),
    nome = trim(_dados->>'nome'),
    categoria = _dados->>'categoria',
    marca = coalesce(trim(_dados->>'marca'), ''),
    modelo = coalesce(trim(_dados->>'modelo'), ''),
    numero_serie = nullif(trim(_dados->>'numero_serie'), ''),
    data_compra = (_dados->>'data_compra')::date,
    valor_compra_centavos = (_dados->>'valor_compra_centavos')::bigint,
    vida_util_anos = (_dados->>'vida_util_anos')::integer,
    situacao = _situacao
  where id = _id;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_id, 'edicao', case
    when _bem.setor is distinct from coalesce(trim(_dados->>'setor'), '')
      then format('Setor: %s → %s', coalesce(nullif(_bem.setor, ''), '—'), coalesce(nullif(trim(_dados->>'setor'), ''), '—'))
    when _bem.situacao <> _situacao
      then case _situacao when 'com_defeito' then 'Marcado com defeito' else 'Voltou a uso' end
    else 'Dados atualizados' end);
end $$;

revoke execute on function public.patrimonio_nome_usuario() from public, anon;
revoke execute on function public.patrimonio_pode_gerenciar(uuid) from public, anon;
revoke execute on function public.patrimonio_cadastrar(uuid, jsonb) from public, anon;
revoke execute on function public.patrimonio_editar(uuid, jsonb) from public, anon;
grant execute on function public.patrimonio_nome_usuario() to authenticated, service_role;
grant execute on function public.patrimonio_pode_gerenciar(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_cadastrar(uuid, jsonb) to authenticated, service_role;
grant execute on function public.patrimonio_editar(uuid, jsonb) to authenticated, service_role;

-- ===== 0013_patrimonio_etiquetas =====
-- Patrimônio: registra a impressão de etiquetas. Cada bem impresso ganha um evento no histórico
-- e sai da lista "Etiquetas para reimprimir". Só para bens de empresas que a pessoa gerencia.
create or replace function public.patrimonio_etiquetas_impressas(_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  _n integer;
begin
  if exists (
    select 1 from public.patrimonio_bens b
    where b.id = any(_ids) and not public.patrimonio_pode_gerenciar(b.unidade_id)
  ) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio de uma dessas empresas.';
  end if;

  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  select b.id, 'etiqueta', case when b.reimprimir_etiqueta then 'Reimpressão' else '' end
  from public.patrimonio_bens b
  where b.id = any(_ids) and b.situacao <> 'baixado';
  get diagnostics _n = row_count;

  update public.patrimonio_bens set reimprimir_etiqueta = false
  where id = any(_ids) and reimprimir_etiqueta;
  return _n;
end $$;

revoke execute on function public.patrimonio_etiquetas_impressas(uuid[]) from public, anon;
grant execute on function public.patrimonio_etiquetas_impressas(uuid[]) to authenticated, service_role;

-- ===== 0014_patrimonio_inventario =====
-- Patrimônio: inventário por empresa. Um inventário aberto por empresa de cada vez; cada leitura
-- fica guardada (uma por bem). Quem tem 'patrimonio' na empresa abre, lê, marca defeito, usa
-- "bem sem etiqueta" e fecha. Ninguém escreve direto nas tabelas.

create or replace function public.patrimonio_pode_ver(_unidade uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.pode_gestao(auth.uid(), _unidade, 'patrimonio')
      or public.pode_gestao(auth.uid(), _unidade, 'patrimonio-gerenciar')
$$;

create table public.patrimonio_inventarios (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id),
  aberto_em timestamptz not null default now(),
  aberto_por_nome text not null default public.patrimonio_nome_usuario(),
  fechado_em timestamptz,
  fechado_por_nome text
);
create unique index patrimonio_inventario_aberto on public.patrimonio_inventarios(unidade_id)
  where fechado_em is null;

create table public.patrimonio_leituras (
  inventario_id uuid not null references public.patrimonio_inventarios(id) on delete cascade,
  bem_id uuid not null references public.patrimonio_bens(id),
  lido_em timestamptz not null default now(),
  lido_por_nome text not null default public.patrimonio_nome_usuario(),
  com_defeito boolean not null default false,
  sem_etiqueta boolean not null default false,
  -- Bem de outra empresa lido aqui: fica registrado para o relatório, mas não conta.
  fora_da_empresa boolean not null default false,
  aviso text not null default '',
  primary key (inventario_id, bem_id)
);

grant select on public.patrimonio_inventarios, public.patrimonio_leituras to authenticated;
grant all on public.patrimonio_inventarios, public.patrimonio_leituras to service_role;
alter table public.patrimonio_inventarios enable row level security;
alter table public.patrimonio_leituras enable row level security;

create policy "patrimonio ver inventarios" on public.patrimonio_inventarios for select
to authenticated using (public.patrimonio_pode_ver(unidade_id));
create policy "patrimonio ver leituras" on public.patrimonio_leituras for select to authenticated
using (exists (select 1 from public.patrimonio_inventarios i where i.id = inventario_id));

-- Abre o inventário da empresa, ou devolve o que já está aberto.
create or replace function public.patrimonio_abrir_inventario(_unidade uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _id uuid;
begin
  if not public.patrimonio_pode_ver(_unidade) then
    raise exception 'Você não tem acesso ao Patrimônio nesta empresa.';
  end if;
  select id into _id from public.patrimonio_inventarios
  where unidade_id = _unidade and fechado_em is null;
  if _id is null then
    insert into public.patrimonio_inventarios (unidade_id) values (_unidade) returning id into _id;
  end if;
  return _id;
end $$;

-- Confere o inventário: existe, está aberto e a pessoa tem acesso à empresa dele.
create or replace function public.patrimonio_inventario_aberto(_inventario uuid)
returns public.patrimonio_inventarios
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios;
begin
  select * into _inv from public.patrimonio_inventarios where id = _inventario;
  if not found or not public.patrimonio_pode_ver(_inv.unidade_id) then
    raise exception 'Você não tem acesso a este inventário.';
  end if;
  if _inv.fechado_em is not null then
    raise exception 'Este inventário já foi fechado.';
  end if;
  return _inv;
end $$;

-- Lê uma etiqueta. Devolve {status, bem}: encontrado, ja_lido, outra_empresa, em_transito,
-- baixado ou nao_existe. Só "encontrado" conta para o inventário.
create or replace function public.patrimonio_ler(_inventario uuid, _tombamento bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
  _bem record;
  _info jsonb;
  _status text;
begin
  select b.id, b.tombamento, b.nome, b.unidade_id, b.situacao, u.nome as empresa into _bem
  from public.patrimonio_bens b join public.unidades u on u.id = b.unidade_id
  where b.tombamento = _tombamento;
  if not found then
    return jsonb_build_object('status', 'nao_existe', 'numero', _tombamento);
  end if;
  _info := jsonb_build_object('id', _bem.id, 'tombamento', _bem.tombamento, 'nome', _bem.nome, 'empresa', _bem.empresa);

  if exists (select 1 from public.patrimonio_leituras
             where inventario_id = _inventario and bem_id = _bem.id) then
    _status := 'ja_lido';
  elsif _bem.situacao = 'baixado' then
    _status := 'baixado';
  elsif _bem.unidade_id <> _inv.unidade_id then
    _status := 'outra_empresa';
    insert into public.patrimonio_leituras (inventario_id, bem_id, fora_da_empresa, aviso)
    values (_inventario, _bem.id, true, format('%s · %s (%s)', lpad(_bem.tombamento::text, 6, '0'), _bem.nome, _bem.empresa));
  elsif _bem.situacao = 'em_transito' then
    _status := 'em_transito';
  else
    _status := 'encontrado';
    insert into public.patrimonio_leituras (inventario_id, bem_id) values (_inventario, _bem.id);
  end if;
  return jsonb_build_object('status', _status, 'bem', _info);
end $$;

-- Marca (ou desmarca) defeito num bem já lido neste inventário; muda a situação do bem.
create or replace function public.patrimonio_marcar_defeito(_inventario uuid, _bem uuid, _defeito boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
begin
  update public.patrimonio_leituras set com_defeito = _defeito
  where inventario_id = _inventario and bem_id = _bem and not fora_da_empresa;
  if not found then
    raise exception 'Este bem não foi lido neste inventário.';
  end if;
  update public.patrimonio_bens
  set situacao = case when _defeito then 'com_defeito' else 'em_uso' end
  where id = _bem and unidade_id = _inv.unidade_id and situacao in ('em_uso', 'com_defeito');
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'edicao', case when _defeito then 'Marcado com defeito no inventário' else 'Voltou a uso no inventário' end);
end $$;

-- Bem achado sem etiqueta: conta como encontrado e vai para "Etiquetas para reimprimir".
create or replace function public.patrimonio_sem_etiqueta(_inventario uuid, _bem uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
begin
  if not exists (
    select 1 from public.patrimonio_bens
    where id = _bem and unidade_id = _inv.unidade_id and situacao in ('em_uso', 'com_defeito')
  ) then
    raise exception 'Este bem não é desta empresa ou não está em uso.';
  end if;
  if exists (select 1 from public.patrimonio_leituras where inventario_id = _inventario and bem_id = _bem) then
    raise exception 'Este bem já foi lido neste inventário.';
  end if;
  insert into public.patrimonio_leituras (inventario_id, bem_id, sem_etiqueta) values (_inventario, _bem, true);
  update public.patrimonio_bens set reimprimir_etiqueta = true where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'inventario', 'Encontrado sem etiqueta; etiqueta para reimprimir');
end $$;

-- Fecha o inventário: grava no histórico de cada bem esperado se foi encontrado ou não (sem dar
-- baixa) e devolve o relatório.
create or replace function public.patrimonio_fechar_inventario(_inventario uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  _inv public.patrimonio_inventarios := public.patrimonio_inventario_aberto(_inventario);
  _quando text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  _nao_encontrados jsonb;
begin
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  select b.id, 'inventario',
    case when l.bem_id is null then format('Não encontrado no inventário de %s', _quando)
         else format('Encontrado no inventário de %s', _quando) end
  from public.patrimonio_bens b
  left join public.patrimonio_leituras l on l.inventario_id = _inventario and l.bem_id = b.id
  where b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito');

  select coalesce(jsonb_agg(b.id order by b.tombamento), '[]'::jsonb) into _nao_encontrados
  from public.patrimonio_bens b
  where b.unidade_id = _inv.unidade_id and b.situacao in ('em_uso', 'com_defeito')
    and not exists (select 1 from public.patrimonio_leituras l
                    where l.inventario_id = _inventario and l.bem_id = b.id);

  update public.patrimonio_inventarios
  set fechado_em = now(), fechado_por_nome = public.patrimonio_nome_usuario()
  where id = _inventario;

  return jsonb_build_object(
    'encontrados', (select count(*) from public.patrimonio_leituras where inventario_id = _inventario and not fora_da_empresa),
    'nao_encontrados', _nao_encontrados,
    'com_defeito', (select count(*) from public.patrimonio_leituras where inventario_id = _inventario and com_defeito),
    'fora_da_empresa', (select count(*) from public.patrimonio_leituras where inventario_id = _inventario and fora_da_empresa)
  );
end $$;

revoke execute on function public.patrimonio_pode_ver(uuid) from public, anon;
revoke execute on function public.patrimonio_abrir_inventario(uuid) from public, anon;
revoke execute on function public.patrimonio_inventario_aberto(uuid) from public, anon;
revoke execute on function public.patrimonio_ler(uuid, bigint) from public, anon;
revoke execute on function public.patrimonio_marcar_defeito(uuid, uuid, boolean) from public, anon;
revoke execute on function public.patrimonio_sem_etiqueta(uuid, uuid) from public, anon;
revoke execute on function public.patrimonio_fechar_inventario(uuid) from public, anon;
grant execute on function public.patrimonio_pode_ver(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_abrir_inventario(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_inventario_aberto(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_ler(uuid, bigint) to authenticated, service_role;
grant execute on function public.patrimonio_marcar_defeito(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.patrimonio_sem_etiqueta(uuid, uuid) to authenticated, service_role;
grant execute on function public.patrimonio_fechar_inventario(uuid) to authenticated, service_role;

-- ===== 0015_patrimonio_transferencias =====
-- Patrimônio: transferência de bens entre as empresas do grupo, em dois passos.
-- A origem envia (o bem fica "em trânsito" e continua da origem), o destino confirma o
-- recebimento (o bem passa a ser do destino) e a origem pode cancelar enquanto estiver em trânsito.

create table public.patrimonio_transferencias (
  id uuid primary key default gen_random_uuid(),
  bem_id uuid not null references public.patrimonio_bens(id),
  origem_id uuid not null references public.unidades(id),
  destino_id uuid not null references public.unidades(id),
  situacao text not null default 'em_transito'
    check (situacao in ('em_transito', 'recebida', 'cancelada')),
  -- Situação do bem antes de sair (em uso ou com defeito), devolvida ao chegar ou cancelar.
  situacao_bem text not null,
  observacao text not null default '',
  enviado_em timestamptz not null default now(),
  enviado_por_nome text not null default public.patrimonio_nome_usuario(),
  concluido_em timestamptz,
  concluido_por_nome text,
  check (origem_id <> destino_id)
);
create unique index patrimonio_transferencia_aberta on public.patrimonio_transferencias(bem_id)
  where situacao = 'em_transito';
create index patrimonio_transferencias_destino on public.patrimonio_transferencias(destino_id, situacao);
create index patrimonio_transferencias_origem on public.patrimonio_transferencias(origem_id, situacao);

grant select on public.patrimonio_transferencias to authenticated;
grant all on public.patrimonio_transferencias to service_role;
alter table public.patrimonio_transferencias enable row level security;

create policy "patrimonio ver transferencias" on public.patrimonio_transferencias for select
to authenticated
using (public.patrimonio_pode_ver(origem_id) or public.patrimonio_pode_ver(destino_id));

-- O destino também vê o bem enquanto ele está a caminho.
create policy "patrimonio ver bem a receber" on public.patrimonio_bens for select to authenticated
using (exists (
  select 1 from public.patrimonio_transferencias t
  where t.bem_id = patrimonio_bens.id and t.situacao = 'em_transito'
    and public.patrimonio_pode_ver(t.destino_id)
));

create or replace function public.patrimonio_transferir(_bem uuid, _destino uuid, _observacao text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _b public.patrimonio_bens;
  _id uuid;
begin
  select * into _b from public.patrimonio_bens where id = _bem for update;
  if not found or not public.patrimonio_pode_gerenciar(_b.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _b.situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Só bens em uso ou com defeito podem ser transferidos.';
  end if;
  if _destino = _b.unidade_id or not exists (select 1 from public.unidades where id = _destino) then
    raise exception 'Escolha outra empresa do grupo como destino.';
  end if;

  insert into public.patrimonio_transferencias (bem_id, origem_id, destino_id, situacao_bem, observacao)
  values (_bem, _b.unidade_id, _destino, _b.situacao, coalesce(trim(_observacao), ''))
  returning id into _id;
  update public.patrimonio_bens set situacao = 'em_transito' where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'transferencia_envio', format('Para %s', (select nome from public.unidades where id = _destino)));
  return _id;
end $$;

-- Só quem tem Patrimônio na empresa de destino confirma o recebimento.
create or replace function public.patrimonio_receber(_transferencia uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _t public.patrimonio_transferencias;
begin
  select * into _t from public.patrimonio_transferencias where id = _transferencia for update;
  if not found or not public.patrimonio_pode_ver(_t.destino_id) then
    raise exception 'Só a empresa de destino confirma o recebimento.';
  end if;
  if _t.situacao <> 'em_transito' then
    raise exception 'Esta transferência não está mais em trânsito.';
  end if;
  update public.patrimonio_transferencias
  set situacao = 'recebida', concluido_em = now(), concluido_por_nome = public.patrimonio_nome_usuario()
  where id = _transferencia;
  update public.patrimonio_bens
  set unidade_id = _t.destino_id, situacao = _t.situacao_bem
  where id = _t.bem_id;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_t.bem_id, 'transferencia_recebida', format('De %s para %s',
    (select nome from public.unidades where id = _t.origem_id),
    (select nome from public.unidades where id = _t.destino_id)));
end $$;

-- Só quem gerencia a origem cancela, enquanto estiver em trânsito; o bem volta como estava.
create or replace function public.patrimonio_cancelar_transferencia(_transferencia uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _t public.patrimonio_transferencias;
begin
  select * into _t from public.patrimonio_transferencias where id = _transferencia for update;
  if not found or not public.patrimonio_pode_gerenciar(_t.origem_id) then
    raise exception 'Só quem gerencia a empresa de origem cancela a transferência.';
  end if;
  if _t.situacao <> 'em_transito' then
    raise exception 'Esta transferência não está mais em trânsito.';
  end if;
  update public.patrimonio_transferencias
  set situacao = 'cancelada', concluido_em = now(), concluido_por_nome = public.patrimonio_nome_usuario()
  where id = _transferencia;
  update public.patrimonio_bens set situacao = _t.situacao_bem where id = _t.bem_id;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_t.bem_id, 'transferencia_cancelada',
    format('Ia para %s', (select nome from public.unidades where id = _t.destino_id)));
end $$;

-- Nomes de todas as empresas do grupo (destino da transferência e nomes nas listas), para quem
-- tem Patrimônio em alguma empresa. Só id e nome.
create or replace function public.patrimonio_empresas_do_grupo()
returns table (id uuid, nome text)
language sql stable security definer set search_path = public
as $fn$
  select u.id, u.nome from public.unidades u
  where exists (select 1 from public.unidades x where public.patrimonio_pode_ver(x.id))
  order by u.ordem, u.nome
$fn$;

revoke execute on function public.patrimonio_transferir(uuid, uuid, text) from public, anon;
revoke execute on function public.patrimonio_receber(uuid) from public, anon;
revoke execute on function public.patrimonio_cancelar_transferencia(uuid) from public, anon;
revoke execute on function public.patrimonio_empresas_do_grupo() from public, anon;
grant execute on function public.patrimonio_empresas_do_grupo() to authenticated, service_role;
grant execute on function public.patrimonio_transferir(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.patrimonio_receber(uuid) to authenticated, service_role;
grant execute on function public.patrimonio_cancelar_transferencia(uuid) to authenticated, service_role;

-- ===== 0016_patrimonio_baixa =====
-- Patrimônio: baixa de bens (venda, descarte, furto/perda ou cadastro duplicado). O bem baixado
-- para de depreciar na data da baixa, sai do inventário e das etiquetas, e continua no histórico.
create or replace function public.patrimonio_baixar(_bem uuid, _motivo text, _data date, _observacao text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _b public.patrimonio_bens;
begin
  select * into _b from public.patrimonio_bens where id = _bem for update;
  if not found or not public.patrimonio_pode_gerenciar(_b.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _b.situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Bem em trânsito ou já baixado não pode receber baixa.';
  end if;
  if _motivo not in ('venda', 'descarte', 'furto_perda', 'cadastro_duplicado') then
    raise exception 'Motivo de baixa inválido.';
  end if;
  if _data is null or _data < _b.data_compra or _data > current_date then
    raise exception 'A data da baixa precisa estar entre a compra e hoje.';
  end if;

  update public.patrimonio_bens
  set situacao = 'baixado', baixa_data = _data, baixa_motivo = _motivo,
      baixa_obs = nullif(trim(_observacao), ''), reimprimir_etiqueta = false
  where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'baixa', concat_ws(' · ', case _motivo
      when 'venda' then 'Venda' when 'descarte' then 'Descarte'
      when 'furto_perda' then 'Furto ou perda' else 'Cadastro duplicado' end,
    to_char(_data, 'DD/MM/YYYY'), nullif(trim(_observacao), '')));
end $$;

revoke execute on function public.patrimonio_baixar(uuid, text, date, text) from public, anon;
grant execute on function public.patrimonio_baixar(uuid, text, date, text) to authenticated, service_role;
