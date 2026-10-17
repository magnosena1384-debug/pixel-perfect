-- Pastas de arquivos do Supabase Storage usadas pelo sistema.
-- capas: imagens públicas dos cursos. videos e materiais: privados, liberados por aula
-- (políticas na migração 0000).
insert into storage.buckets (id, name, public)
values ('capas', 'capas', true), ('videos', 'videos', false), ('materiais', 'materiais', false)
on conflict (id) do nothing;
