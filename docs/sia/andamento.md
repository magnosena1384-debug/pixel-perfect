docs/sia/planos/2026-10-19-rh-quarkrh.md

Decisão: sim da pessoa (2026-10-19) para aplicar as migrações 0008–0011 no postos-lemon conforme cada parte ficar pronta — só criam objetos novos de RH — se algo sair do previsto, a migração seguinte espera novo sim.
Decisão: a ligação recusou duas vezes aplicar a 0008 (bloqueio de permissão da sessão); a pessoa mandou seguir com o que não depende do banco — partes 1 a 5 seguem no código, com as migrações escritas e não aplicadas — até aplicar, a gravação e o painel com dados reais ficam sem prova de sistema.
Decisão: "RH – importar" também dá "RH" (ver), no banco e na tela — quem importa precisa ver o que gravou, e gravar devolvendo o registro exige leitura — custa um gerente com só importar ver o painel daquela unidade.
Decisão: .env saiu do Git (git rm --cached) e entrou no .gitignore — AGENTS.md proíbe segredo no Git — quem clonar precisa criar o .env a partir do .env.example.
Parte 1: código pronto, banco pendente (npx vitest run → 33 passed; npx tsc --noEmit → ok; eslint → ok; vite build → ok; SQL de acesso → falhou como esperado: rh_ponto_dias não existe)
Parte 2: código pronto, banco pendente (npx vitest run → 45 passed; tsc → ok; eslint → ok; vite build → ok; migração 0009 escrita, não aplicada)
Parte 3: código pronto, banco pendente (npx vitest run → 52 passed; tsc → ok; eslint → ok; vite build → ok; migração 0010 escrita, não aplicada)
Parte 4: código pronto, banco pendente (npx vitest run → 58 passed; tsc → ok; eslint → ok; vite build → ok; corpo da 0011 validado por consulta só de leitura com dados de exemplo; migração não aplicada)
