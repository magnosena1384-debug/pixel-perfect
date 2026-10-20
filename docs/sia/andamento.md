docs/sia/planos/2026-10-20-patrimonio.md

O andamento do RH está em docs/sia/andamentos/rh.md (código pronto, migrações 0008–0011 pendentes).

Decisão: as migrações do patrimônio não têm o sim da pessoa nem a ferramenta liberada — as partes fecham "código pronto, banco pendente" e o sim é pedido no fim — sem o banco, nenhuma tela grava.
Decisão: a prova de banco roda como ensaio que se desfaz (migração + prova numa transação que termina em erro de propósito) enquanto aplicar estiver bloqueado — prova as regras sem gravar nada — custa: o banco real só confirma quando a migração for aplicada.
Decisão: o nome de quem agiu fica gravado no histórico (quem_nome), porque o gerente não lê o perfil de outras pessoas — custa: se a pessoa mudar o nome, o histórico antigo mantém o nome antigo.
Decisão: useUnidadesCom e normalizarTexto saíram do RH para lib/gestao.ts e lib/utils.ts — RH e Patrimônio usam os mesmos.
Parte 1: código pronto, banco pendente (npx vitest run → 71 passed; tsc → ok; eslint → ok; vite build → ok; ensaio da 0012 no Supabase → RESULTADO ok=11 falhas= (provas 1, 6, 12, 13), desfeito e conferido que nada ficou)
Decisão: a Pimaco 6180 é folha Carta (216 × 279 mm), não A4 — o combinado foi corrigido e a impressão sai em Carta com o mesmo modelo, 30 por folha, 25,4 × 66,7 mm — custa: quem comprar folha A4 de outro modelo precisa de um formato novo.
Parte 2: código pronto, banco pendente (npx vitest run → 75 passed; tsc → ok; eslint → ok; vite build → ok; migração 0013 escrita, não aplicada)
