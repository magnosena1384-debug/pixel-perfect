docs/sia/planos/2026-10-19-rh-quarkrh.md

Decisão: sim da pessoa (2026-10-19) para aplicar as migrações 0008–0011 no postos-lemon conforme cada parte ficar pronta — só criam objetos novos de RH — se algo sair do previsto, a migração seguinte espera novo sim.
Decisão: a ligação recusou duas vezes aplicar a 0008 (bloqueio de permissão da sessão); a pessoa mandou seguir com o que não depende do banco — partes 1 a 5 seguem no código, com as migrações escritas e não aplicadas — até aplicar, a gravação e o painel com dados reais ficam sem prova de sistema.
Decisão: "RH – importar" também dá "RH" (ver), no banco e na tela — quem importa precisa ver o que gravou, e gravar devolvendo o registro exige leitura — custa um gerente com só importar ver o painel daquela unidade.
Decisão: .env saiu do Git (git rm --cached) e entrou no .gitignore — AGENTS.md proíbe segredo no Git — quem clonar precisa criar o .env a partir do .env.example.
Parte 1: código pronto, banco pendente (npx vitest run → 33 passed; npx tsc --noEmit → ok; eslint → ok; vite build → ok; SQL de acesso → falhou como esperado: rh_ponto_dias não existe)
Parte 2: código pronto, banco pendente (npx vitest run → 45 passed; tsc → ok; eslint → ok; vite build → ok; migração 0009 escrita, não aplicada)
Parte 3: código pronto, banco pendente (npx vitest run → 52 passed; tsc → ok; eslint → ok; vite build → ok; migração 0010 escrita, não aplicada)
Parte 4: código pronto, banco pendente (npx vitest run → 58 passed; tsc → ok; eslint → ok; vite build → ok; corpo da 0011 validado por consulta só de leitura com dados de exemplo; migração não aplicada)
Decisão: a ficha usa o endereço /gestao/rh/colaborador/$unidade/$colaborador (dois parâmetros) em vez de um $id composto — evita codificar "unidade|nome" na URL — custa um endereço mais longo.
Parte 5: código pronto, banco pendente (npx vitest run → 60 passed; tsc → ok; eslint → ok; vite build → ok)
Revisão (revisor separado, commits 3102b22..8b9af0f): 1 grave (provas de banco 11–13 nunca passaram: migrações não aplicadas), 5 importantes, 14 miúdos.
Correção: arquivo de Irregularidades ou Banco de Horas sem nenhuma linha lida é recusado (antes apagava o período/o banco da unidade) — prova em rh-planilha.test.ts.
Decisão: a Frequência troca só as pessoas que vieram no arquivo (0008); Irregularidades continuam trocando o período inteiro da unidade, porque o relatório omite quem não teve ocorrência e uma falta abonada precisa sumir; Banco de Horas troca a foto inteira — a prévia diz isso antes de gravar — custa: uma exportação de Irregularidades filtrada por pessoa apaga as ocorrências das outras no período.
Correção: rh_ticket_vendas (0011) só busca nome e CPF no cadastro da mesma empresa (antes podia devolver os de outro posto) — teste de acesso ganhou ticket e registro de importações.
Correção: ficha com os cartões de Atestados, Horas extras e Banco de horas; rótulo "Saldos" na prévia; aviso de erro do ticket; porcentagem formatada num lugar só.
Decisão: provas 1, 5 e 9 com a planilha real só rodam nesta máquina (docs/contexto fora do Git); 1 e 9 também têm versão com linhas inventadas, a 5 é uma propriedade dos dados reais — custa: em outra máquina essas três não são conferidas no arquivo real.
Adiado (miúdo): setor e casamento por nome sem unidade quando há homônimos em postos diferentes; paginação do ticket ordenada por nome; data_ref com hora perde o último dia; feito_por de rh_importacoes pode ser forjado por insert direto; dois colaboradores com o mesmo nome normalizado no posto quebram a importação; filtro de colaborador mostra o nome normalizado; a ficha carrega 12 meses do posto inteiro; a chave publicável do .env antigo segue no histórico do Git (é pública).
Revisão: correções feitas (npx vitest run → 62 passed; tsc → ok; eslint → ok; vite build → ok); provas de banco 11–13 continuam pendentes.
