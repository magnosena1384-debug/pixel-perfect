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
