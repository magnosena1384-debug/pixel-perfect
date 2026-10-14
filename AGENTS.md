# Postos Lemon — notas para quem mexe no código

- O projeto não usa mais o Lovable. Banco e login ficam num Supabase próprio; o site roda na Vercel.
- Não reescreva histórico já publicado (force push, rebase ou amend de commits enviados).
- Mudanças no banco entram como nova migração em `drizzle/migrations/` (com entrada no
  `meta/_journal.json`); depois rode `npm run db:gerar-instalacao` para atualizar
  `supabase/instalar-banco.sql`. Nunca edite uma migração já aplicada.
- `src/integrations/supabase/types.ts` reflete o banco: atualize junto com cada migração.
- Antes de enviar: `bun run lint`, `bunx tsc --noEmit` e `bun run test`.
