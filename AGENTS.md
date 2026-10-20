# Postos Lemon — notas para quem mexe no código

- O projeto não usa mais o Lovable. Banco e login ficam num Supabase próprio; o site roda na Vercel.
- Não reescreva histórico já publicado (force push, rebase ou amend de commits enviados).
- Mudanças no banco entram como nova migração em `drizzle/migrations/` (com entrada no
  `meta/_journal.json`); depois rode `npm run db:gerar-instalacao` para atualizar
  `supabase/instalar-banco.sql`. Nunca edite uma migração já aplicada.
- `src/integrations/supabase/types.ts` reflete o banco: atualize junto com cada migração.
- Antes de enviar: `bun run lint`, `bunx tsc --noEmit` e `bun run test`.

<!-- SIA:inicio -->
# Para o agente

O que o sistema faz está em docs/sia/combinado.md. Este arquivo não repete isso.

## Prova

- Regra: `npx vitest run` (ou `bun run test`)
- Quem usa: sem ferramenta de fluxo no browser neste projeto; abrir a tela logado continua manual
- Sistema: `supabase/testes/rh_acessos.sql`, rodado pela ligação com o Supabase (termina em `RESULTADO ok=<n> falhas=`)
- Lint: `npx eslint <arquivos alterados>` (ou `bun run lint`)
- Tipos: `npx tsc --noEmit` (ou `bunx tsc --noEmit`)

## Pronto

Pronto só com esses comandos rodados nesta conversa, saída lida, e cada parte do plano com `Parte N: pronta (<comando> → <resultado>)` em docs/sia/andamento.md.

## Banco e segredo

Segredo não entra no browser nem no log. `.env` não entra no Git. `.env.example`, se existir, tem o nome e uma frase, sem valor. Se docs/sia/escolhas.md disser Supabase, a mudança do banco sobe pela ligação. Não cole SQL no painel. Se disser Postgres com Drizzle, o SQL do repositório é a mudança. Se disser Uso: ativo, consulta segue, alteração pede sim, delete só pela saída para apagar de `dados`. Alteração automática só com a linha Banco ativo: alterações com volta, e a trava está em `dados`.
<!-- SIA:fim -->
