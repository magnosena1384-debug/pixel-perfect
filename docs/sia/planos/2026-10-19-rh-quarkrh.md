# Plano: RH — painel do QuarkRH

**Objetivo:** a aba RH da Gestão importa os três relatórios Excel do QuarkRH por unidade e mostra
horas, faltas, atrasos, pontualidade, atestados e banco de horas por unidade, setor e colaborador.

**Como se encaixa:** o RH vira duas permissões novas por unidade ("rh" e "rh-importar") ao lado dos
módulos da Gestão, sem virar coleção de `gestao_itens`. Os dados lidos do Excel (no navegador)
vão para tabelas próprias `rh_*`, com regra de quem vê no banco (`pode_gestao`). O painel busca as
linhas do período das unidades permitidas e calcula tudo com funções puras em `src/lib/rh/`.

**Escolhas:** TanStack Start, Supabase postos-lemon (ligação ligada, Uso: ativo), Vitest, Vercel.

**Combinado:** docs/sia/combinados/rh.md

**Cara:** docs/sia/visual.md

**Ritmo:** até o fim

## Vale em todas as partes

- Horas trabalhadas do dia = Diurna + Noturna + Extras Normais + Extras 100% (H.N. não soma).
- Falta sem justificativa = data marcada FALTA nas Irregularidades. Atraso = data marcada ATRASO.
- Minutos de atraso = coluna Descontos do ponto nas datas de ATRASO.
- Pontualidade = dias trabalhados (com ao menos uma batida) sem ATRASO ÷ dias trabalhados.
- Atestado = dia do ponto com "atestado" na Observação (sem diferenciar maiúsculas/acentos).
- Colaborador = CPF quando houver; nos relatórios sem CPF, nome normalizado (sem acento, maiúsculo,
  espaços colapsados) dentro da mesma unidade. A chave gravada é sempre o nome normalizado; o CPF é
  atributo.
- Reimportar um relatório da mesma unidade substitui só o período do arquivo, numa transação.
- Horas exibidas em `HH:MM`, porcentagem com uma casa, números `tabular-nums`, tokens de visual.md.
- Banco ativo: cada migração desta lista é mostrada em uma frase e só sobe com o sim da pessoa.
- Antes de cada commit: `npx eslint <arquivos da parte>`, `npx tsc --noEmit`, `npx vitest run`.
- As planilhas reais em `docs/contexto/quarkrh/` não vão para o Git. Testes de CI usam linhas
  inventadas com a mesma forma; o teste com o arquivo real só roda se ele existir na máquina.

## O que mais pode morder

1. Excel `.xls` antigo (BIFF) com células mescladas e seções de 2 ou 3 pares de batidas: o leitor
   pode desalinhar colunas. Prova: ler pelo nome do cabeçalho de cada seção (Parte 1).
2. Nome igual com acento ou espaço diferente entre relatórios vira duas pessoas. Prova 14 (Parte 2).
3. Arquivo grande estourar o limite de 1000 linhas por leitura do banco no painel. Prova: a busca
   pagina até acabar (Parte 1).
4. Reimportação parcial deixar dados pela metade se falhar no meio. Prova: gravação numa função
   única do banco, tudo ou nada (Parte 1).
5. Ticket de vendas ligar à pessoa errada quando dois funcionários têm o mesmo nome em postos
   diferentes. Prova: o casamento é por CPF e, sem CPF, por nome dentro da mesma unidade (Parte 4).

---

### Parte 1: Importar a Frequência e ver as horas

**Arquivos:**
- Mudar: `package.json`, `bun.lock` — dependência `xlsx` (SheetJS 0.20.3, do tarball oficial
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; a do npm é antiga).
- Criar: `src/lib/rh/planilha.ts` — leitura dos relatórios (linhas → registros).
- Criar: `src/lib/rh/indicadores.ts` — contas puras do painel.
- Criar: `src/lib/rh/dados.ts` — hooks de leitura e gravação no Supabase.
- Criar: `drizzle/migrations/0008_rh_ponto.sql` (+ `meta/_journal.json`, `npm run db:gerar-instalacao`)
  — tabelas `rh_importacoes` e `rh_ponto_dias`, regras de quem vê, função `rh_gravar_ponto`.
- Mudar: `src/integrations/supabase/types.ts` — tabelas e função novas.
- Mudar: `src/lib/gestao.ts` — `PERMISSOES` (os 5 módulos + "rh" + "rh-importar"), tipo
  `Permissao`; `useMeusAcessos`/`useUnidadeAtual` passam a devolver `Set<Permissao>`.
- Mudar: `src/routes/_authenticated/admin.acessos.tsx` — colunas a partir de `PERMISSOES`.
- Mudar: `src/routes/gestao.tsx` — aba "RH" para quem tem "rh".
- Mudar: `src/components/gestao/ui.tsx` — peça `Cartao` (rótulo `eyebrow`, valor, linha de baixo,
  classe de cor); `src/routes/gestao.dashboard.tsx` e `gestao.vendas.tsx` passam a usá-la.
- Criar: `src/routes/gestao.rh.tsx` (layout com sub-abas Painel/Importar),
  `src/routes/gestao.rh.index.tsx` (painel), `src/routes/gestao.rh.importar.tsx`.
- Prova: `src/test/rh-planilha.test.ts`, `src/test/rh-indicadores.test.ts` (regra),
  `supabase/testes/rh_acessos.sql` (sistema, roda pela ligação dentro de transação desfeita).

**Encaixa:**
- Entrega: `lerRelatorio(linhas: unknown[][]) -> Relatorio` (união `{ tipo: "frequencia", dias:
  DiaPonto[], de, ate } | ...`), `normalizarNome(nome) -> string`, `horasParaMin("94:22") -> 5662`,
  `minParaHoras(5662) -> "94:22"`, `resumoRh(dias, irregularidades) -> ResumoRh`,
  `useDadosRh(de, ate) -> { dias, irregularidades, banco }`, `gravarImportacao(unidadeId, relatorio,
  arquivo)`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Frequência inventada com duas seções (uma com 2 pares, outra com 3 pares de batidas) vira
    `DiaPonto` por dia com jornada, batidas, minutos de cada coluna, observação, `folga` e
    `trabalhou`; linha "Somatório" ignorada.
  - Prova 2: feriado com só `04:09` em Extras 100% conta 249 minutos trabalhados.
  - Prova 3: a soma de cada coluna de um colaborador bate com o "Somatório" dele (o leitor devolve
    `somatorios` por pessoa e o teste compara).
  - Prova 10: uma planilha qualquer (`[["Produto","Preço"],["A","1"]]`) lança
    `ErroRelatorio("Este arquivo não parece um relatório do QuarkRH …")`.
  - Prova 1 (só se `docs/contexto/quarkrh/RelatorioFrequenciaAnalitico.xls` existir): 13
    colaboradores e 247 dias; todos os somatórios batem.
  - `resumoRh` com dias inventados: horas totais, média por colaborador com ponto.
  - `supabase/testes/rh_acessos.sql`: em transação desfeita, cria duas unidades de teste e dois
    usuários de teste; prova 12 (quem tem "rh" só na A não lê linhas da B) e prova 13 (quem não
    tem "rh-importar" não grava); prova 11 (chamar `rh_gravar_ponto` duas vezes com o mesmo
    período deixa o mesmo número de dias). Termina com `raise exception` contendo
    `RESULTADO ok=<n> falhas=<lista>`, o que desfaz tudo.

- [ ] **Passo 2: Rodar e ver falhar**
  Rodar: `npx vitest run src/test/rh-planilha.test.ts src/test/rh-indicadores.test.ts`
  Esperado: FAIL porque `@/lib/rh/planilha` e `@/lib/rh/indicadores` não existem.
  Rodar o SQL de teste pela ligação. Esperado: erro porque `rh_ponto_dias` não existe.

- [ ] **Passo 3: Implementar**
  - `lerRelatorio` reconhece pelo cabeçalho: seção começando por nome sozinho na linha + linha
    `Dia|Jornada|…` = Frequência; índices das colunas lidos do cabeçalho de cada seção.
  - Migração 0008 (mostrar à pessoa e esperar o sim): `rh_importacoes(id, unidade_id, relatorio,
    arquivo, periodo_de, periodo_ate, quantidade, feito_por, criado_em)`; `rh_ponto_dias(unidade_id,
    colaborador, nome, data, jornada, batidas text[], diurna_min, noturna_min, extras_min,
    extras100_min, hn_min, descontos_min, observacao, folga, trabalhou, importacao_id)`, chave
    `(unidade_id, colaborador, data)`. Leitura: `pode_gestao(auth.uid(), unidade_id, 'rh')`.
    Escrita só pela função `rh_gravar_ponto(_unidade uuid, _arquivo text, _de date, _ate date,
    _dias jsonb) returns integer` (security invoker), que confere `'rh-importar'`, apaga o período
    da unidade e insere, tudo numa transação.
  - Tela de importação: `Painel`, `Campo`, `Seletor`, `Input type=file`; prévia; "Gravar"
    desabilitado enquanto grava (`Button`), toast de sucesso com o resumo; abaixo, "Últimas
    importações" lendo `rh_importacoes` da unidade (lista simples até a `Tabela` virar peça na
    Parte 3).
  - Painel: filtros (período, unidade) e `Cartao` de Horas trabalhadas (`bg-ink text-cream`) com
    média por colaborador; `Vazio` com atalho para Importar; "Carregando…".
  - `useDadosRh` busca `rh_ponto_dias` do período, paginando de 1000 em 1000.

- [ ] **Passo 4: Rodar e ver passar**
  Rodar: `npx vitest run` e o SQL de teste pela ligação.
  Esperado: PASS; SQL termina com `RESULTADO ok=3 falhas=`. Abrir `/gestao/rh/importar`, subir a
  Frequência real numa unidade e ver as horas no painel.

- [ ] **Passo 5: Commit**

### Parte 2: Irregularidades — faltas, atrasos, pontualidade, atestados

**Arquivos:**
- Mudar: `src/lib/rh/planilha.ts`, `src/lib/rh/indicadores.ts`, `src/lib/rh/dados.ts`
- Criar: `drizzle/migrations/0009_rh_irregularidades.sql` (+ journal, instalação, `types.ts`) —
  `rh_irregularidades(unidade_id, colaborador, nome, cpf, cargo, setor, vinculo, tipo, data,
  importacao_id)`, chave `(unidade_id, colaborador, tipo, data)`, mesmas regras; função
  `rh_gravar_irregularidades(_unidade, _arquivo, _de, _ate, _linhas jsonb)`.
- Mudar: `src/routes/gestao.rh.index.tsx`, `src/routes/gestao.rh.importar.tsx`
- Prova: `src/test/rh-planilha.test.ts`, `src/test/rh-indicadores.test.ts`, `supabase/testes/rh_acessos.sql`

**Encaixa:**
- Usa: `lerRelatorio`, `normalizarNome`, `DiaPonto`, `gravarImportacao`.
- Entrega: `Irregularidade { colaborador, nome, cpf, cargo, setor, tipo, data }`; `ResumoRh` ganha
  `faltas`, `atrasos`, `minutosAtraso`, `pontualidade`, `atestados`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Prova 4: linha com `FALTA` e Datas `"02/10/2026, 19/10/2026"` vira 2 irregularidades com CPF,
    cargo e setor; linha "Total:" ignorada.
  - Prova 5: com o arquivo real presente, toda FALTA cai num dia sem batida e sem observação.
  - Prova 6: ATRASO em dois dias com Descontos 00:53 e 01:31 = 144 minutos; FALTA (08:00) fora.
  - Prova 7: 10 dias trabalhados, 2 com ATRASO → pontualidade 80,0%.
  - Prova 8: "Atestado médico" conta 1 atestado; "Férias", "Feriado", "FOLGA | Abonada (04:00)"
    não contam como falta nem atestado.
  - Prova 14: "José  da Silva " e "JOSE DA SILVA" viram o mesmo colaborador.
  - SQL: prova 12 e 13 também para `rh_irregularidades`.

- [ ] **Passo 2: Rodar e ver falhar**
  Rodar: `npx vitest run src/test/rh-planilha.test.ts src/test/rh-indicadores.test.ts`
  Esperado: FAIL porque o leitor ainda recusa Irregularidades e `ResumoRh` não tem `faltas`.

- [ ] **Passo 3: Implementar**
  Leitor reconhece o cabeçalho `Data Inicial|Data Final|Nome do Colaborador|CPF|…`. Migração 0009
  mostrada à pessoa e aplicada após o sim. Cartões Faltas (`bg-destructive` quando > 0), Atrasos
  (`bg-amber-400 text-black` quando > 0), Pontualidade (`bg-secondary`), Atestados (`bg-card`).
  Filtro Colaborador. A prévia mostra quantas ocorrências de cada tipo.

- [ ] **Passo 4: Rodar e ver passar**
  Rodar: `npx vitest run` e o SQL de teste. Esperado: PASS. Importar as Irregularidades reais e ver
  faltas e atrasos iguais aos do QuarkRH.

- [ ] **Passo 5: Commit**

### Parte 3: Banco de horas, horas extras e setores

**Arquivos:**
- Mudar: `src/lib/rh/planilha.ts`, `src/lib/rh/indicadores.ts`, `src/lib/rh/dados.ts`
- Criar: `drizzle/migrations/0010_rh_banco_horas.sql` (+ journal, instalação, `types.ts`) —
  `rh_banco_horas(unidade_id, colaborador, nome, setor, admissao, credito_min, debito_min,
  saldo_min, referencia, importacao_id)`, chave `(unidade_id, colaborador)`; função
  `rh_gravar_banco_horas(_unidade, _arquivo, _referencia, _linhas jsonb)` que troca o da unidade.
- Mudar: `src/routes/gestao.rh.index.tsx`, `src/routes/gestao.rh.importar.tsx`
- Prova: `src/test/rh-planilha.test.ts`, `src/test/rh-indicadores.test.ts`, `supabase/testes/rh_acessos.sql`

**Encaixa:**
- Usa: `Irregularidade.setor`, `DiaPonto`.
- Entrega: `BancoHoras`; `setorDe(colaborador, irregularidades, banco) -> string` ("Sem setor");
  `horasPorSetor(dias, setorDe) -> { setor, colaboradores, minutos, media }[]`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Prova 9: Banco de Horas inventado com saldo `"-01:12"` vira −72 minutos; referência lida de
    "Saldo em (31/12/2026)"; linha "Totais" ignorada; com o arquivo real, 13 colaboradores.
  - Setor vem das Irregularidades ou do Banco, e cai em "Sem setor" sem nenhum dos dois; o valor
    `"PISTA "` vira `"PISTA"`.
  - Horas extras = Extras Normais + Extras 100%.

- [ ] **Passo 2: Rodar e ver falhar**
  Rodar: `npx vitest run src/test/rh-planilha.test.ts src/test/rh-indicadores.test.ts`
  Esperado: FAIL porque o Banco de Horas é recusado e `horasPorSetor` não existe.

- [ ] **Passo 3: Implementar**
  Migração 0010 mostrada e aplicada após o sim. Cartões Horas extras e Saldo do banco (`bg-card`).
  Bloco "Horas por setor": barras horizontais (`--chart-2`, `ChartContainer`) + `Tabela`. Filtro
  Setor. Mover a `Tabela` de `gestao.dashboard.tsx` para `src/components/gestao/ui.tsx`.

- [ ] **Passo 4: Rodar e ver passar**
  Rodar: `npx vitest run` e o SQL de teste. Esperado: PASS.

- [ ] **Passo 5: Commit**

### Parte 4: Comparar postos e tabela por colaborador, com ticket de vendas

**Arquivos:**
- Mudar: `src/lib/rh/indicadores.ts`, `src/lib/rh/dados.ts`
- Criar: `drizzle/migrations/0011_rh_ticket_vendas.sql` (+ journal, instalação, `types.ts`) —
  função `rh_ticket_vendas(_de date, _ate date)` (security definer) que devolve, para as unidades
  com "rh", `unidade_id, cpf, nome, total, cupons` por funcionário do webPosto (cupons de `VENDAS`
  não cancelados, nome e CPF de `FUNCIONARIOS`), sem outros dados pessoais.
- Mudar: `src/routes/gestao.rh.index.tsx`
- Prova: `src/test/rh-indicadores.test.ts`

**Encaixa:**
- Usa: `resumoRh`, `setorDe`, `Tabela`, `Cartao`.
- Entrega: `porUnidade(...) -> LinhaRh[]`, `porColaborador(...) -> LinhaRh[]` (ordenado por faltas
  e atrasos), `casarVendas(colaboradores, vendas) -> Map<colaborador, { total, cupons, ticket }>`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Dois postos com números diferentes geram duas linhas com os valores de cada um.
  - Ordem por colaborador: mais faltas primeiro, depois mais atrasos.
  - Vendas casam por CPF; sem CPF, por nome normalizado **na mesma unidade**; homônimo em outra
    unidade não casa.
  - Ticket = total ÷ cupons; sem vendas, `null` (tela mostra "—").

- [ ] **Passo 2: Rodar e ver falhar**
  Rodar: `npx vitest run src/test/rh-indicadores.test.ts`
  Esperado: FAIL porque `porUnidade`, `porColaborador` e `casarVendas` não existem.

- [ ] **Passo 3: Implementar**
  Migração 0011 mostrada e aplicada após o sim. "Comparar postos" só com mais de uma unidade
  visível; "Por colaborador" com nome como link para a ficha (`/gestao/rh/colaborador/$id`, rota
  criada na Parte 5; até lá, sem link).

- [ ] **Passo 4: Rodar e ver passar**
  Rodar: `npx vitest run`. Esperado: PASS.

- [ ] **Passo 5: Commit**

### Parte 5: Ficha do colaborador mês a mês

**Arquivos:**
- Mudar: `src/lib/rh/indicadores.ts`
- Criar: `src/routes/gestao.rh.colaborador.$id.tsx`
- Mudar: `src/routes/gestao.rh.index.tsx` (link do nome)
- Prova: `src/test/rh-indicadores.test.ts`

**Encaixa:**
- Usa: `resumoRh`, `useDadosRh`, `Cartao`, `Tabela`, `ChartContainer`.
- Entrega: `mesAMes(dias, irregularidades) -> { mes: "2026-10", ...ResumoRh }[]`,
  `diasQueContam(dias, irregularidades) -> { data, tipo, observacao }[]`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Dias de setembro e outubro geram dois meses, cada um com suas horas, faltas, atrasos, minutos e
    pontualidade.
  - `diasQueContam` lista falta, atraso, atestado, férias e abono, mais recente primeiro; dia
    normal não entra.

- [ ] **Passo 2: Rodar e ver falhar**
  Rodar: `npx vitest run src/test/rh-indicadores.test.ts`
  Esperado: FAIL porque `mesAMes` não existe.

- [ ] **Passo 3: Implementar**
  Cabeçalho com nome, unidade, setor, cargo e CPF; cartões; gráfico (linha `--chart-2` para horas,
  barras `destructive` e `amber-400` para faltas e atrasos) com `Tabela` abaixo; lista `divide-y`
  com pílulas (Falta `bg-destructive`, Atraso `bg-amber-400 text-black`, outros `bg-muted`).
  Colaborador sem dados ou de unidade sem acesso: `Painel` "Você não tem acesso…" / `Vazio`.

- [ ] **Passo 4: Rodar e ver passar**
  Rodar: `npx vitest run`. Esperado: PASS.

- [ ] **Passo 5: Commit**

## Provas do combinado → parte

1 → P1 · 2 → P1 · 3 → P1 · 4 → P2 · 5 → P2 · 6 → P2 · 7 → P2 · 8 → P2 · 9 → P3 · 10 → P1 ·
11 → P1 · 12 → P1 (e P2, P3 nas tabelas novas) · 13 → P1 (e P2, P3) · 14 → P2
