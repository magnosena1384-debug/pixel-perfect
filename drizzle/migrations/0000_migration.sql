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
