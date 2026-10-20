# Plano: Patrimônio

**Objetivo:** a aba Patrimônio da Gestão cadastra bens com tombamento único, imprime etiquetas com
QR, faz inventário pela câmera do celular, transfere bens entre empresas em dois passos, dá baixa
e mostra o valor atual depois da depreciação.

**Como se encaixa:** duas permissões novas por empresa ("patrimonio" e "patrimonio-gerenciar") em
`PERMISSOES` (`src/lib/gestao.ts`), como o RH. Os bens ficam em tabelas `patrimonio_*` com leitura
pela regra `pode_gestao`; toda escrita passa por funções do banco que conferem a permissão e
gravam o histórico — ninguém escreve direto nas tabelas. As contas (depreciação, etiquetas,
número lido) são funções puras em `src/lib/patrimonio/`.

**Escolhas:** TanStack Start, Supabase postos-lemon (ligação ligada, Uso: ativo), Vitest, Vercel.

**Combinado:** docs/sia/combinado.md

**Cara:** docs/sia/visual.md (Página: Patrimônio)

**Ritmo:** até o fim

## Vale em todas as partes

- Tombamento: inteiro gerado pelo banco (`generated always as identity`), exibido com 6 dígitos.
- Depreciação mensal = valor de compra ÷ (vida útil × 12); meses completos desde a compra até hoje
  ou até a baixa; valor atual nunca abaixo de zero. Valores em centavos.
- Vida útil sugerida: Bombas e equipamentos de pista 10; Máquinas e equipamentos 10; Móveis e
  utensílios 10; Informática 5; Veículos 5; Ferramentas 5; Outros 10.
- Etiquetas: Pimaco 6180 (Carta) (3 colunas × 10 linhas, 25,4 × 66,7 mm) e térmica 50 × 30 mm. O QR
  guarda só o número do tombamento.
- A empresa do bem só muda por transferência recebida.
- Banco ativo: cada migração desta lista é mostrada em uma frase e só sobe com o sim da pessoa.
  A ferramenta de aplicar migração está bloqueada pela permissão da sessão (ver RH); enquanto
  estiver, as partes fecham "código pronto, banco pendente".
- Antes de cada commit: `npx eslint <arquivos da parte>`, `npx tsc --noEmit`, `npx vitest run`.

## O que mais pode morder

1. Dois cadastros ao mesmo tempo gerarem o mesmo tombamento. Prova: o número vem de identidade
   do banco, nunca calculado no navegador (Parte 1, SQL).
2. Câmera no iPhone (Safari não lê QR sozinho). Prova: leitura usa `qr-scanner`, que funciona
   nos dois; a regra de interpretar o texto lido é pura e testada (Parte 3). Câmera real só no
   celular, com a pessoa.
3. Leitor USB de código de barras comum (1D) não lê QR. O campo de digitação aceita qualquer
   leitor; para ler a etiqueta com leitor, ele precisa ser 2D (QR). Dito à pessoa.
4. Impressora térmica ignorar o tamanho da página. Prova: a página de impressão usa `@page` com o
   tamanho exato e a regra de montagem das páginas é testada (Parte 2); o ajuste fino é na
   impressora, com a pessoa.
5. Bem em trânsito sumir para as duas empresas. Prova: SQL de acesso confere que origem e destino
   veem o bem em trânsito (Parte 4).

---

### Parte 1: Cadastrar bens e ver o valor atual

**Arquivos:**
- Criar: `src/lib/patrimonio/regras.ts` — categorias, vida útil, `depreciacao`, `formatarTombamento`.
- Criar: `src/lib/patrimonio/dados.ts` — leitura e chamadas às funções do banco.
- Criar: `drizzle/migrations/0012_patrimonio_bens.sql` (+ journal, instalação, `types.ts`) —
  `patrimonio_bens`, `patrimonio_historico`, leitura por `pode_gestao`, funções
  `patrimonio_cadastrar` e `patrimonio_editar` (security definer, conferem "patrimonio-gerenciar").
- Mudar: `src/lib/gestao.ts` — `PERMISSOES` ganha "patrimonio" e "patrimonio-gerenciar";
  "gerenciar" também dá "patrimonio" em `permissoesDe`.
- Mudar: `src/routes/gestao.tsx` — aba "Patrimônio".
- Criar: `src/routes/gestao.patrimonio.tsx` (layout e sub-abas), `gestao.patrimonio.index.tsx`
  (Bens), `gestao.patrimonio.novo.tsx`, `gestao.patrimonio.bem.$id.tsx` (ficha e edição).
- Criar: peça `PilulaSituacao` em `src/components/gestao/ui.tsx`.
- Prova: `src/test/patrimonio-regras.test.ts`, `src/test/rh-permissoes.test.ts` (lista de
  permissões), `supabase/testes/patrimonio_acessos.sql`.

**Encaixa:**
- Entrega: `depreciacao(bem, hoje) -> { mensal, meses, acumulada, atual }`,
  `formatarTombamento(123) -> "000123"`, `VIDA_UTIL`, `useBens()`, `cadastrarBem(dados)`,
  `editarBem(id, dados)`, `PilulaSituacao`.

- [ ] **Passo 1: Escrever as provas que falham**
  - Prova 3: R$ 12.000,00, 10 anos, compra 2026-01-15 → em 2026-10-14 vale 1.120.000 centavos;
    em 2026-10-15, 1.110.000.
  - Prova 4: 5 anos, comprado há 7 anos → atual 0.
  - Prova 5 (parte da regra): baixado em 2026-03-15 não deprecia depois dessa data.
  - `formatarTombamento(123)` = "000123"; vida útil sugerida por categoria.
  - Permissões: lista com "patrimonio" e "patrimonio-gerenciar"; gerenciar dá ver.
  - SQL (transação desfeita): prova 1 (dois cadastros em empresas diferentes → números
    seguidos e diferentes), prova 6 (função de cadastro devolve o bem existente quando o nº de
    série repete, sem gravar), prova 12 (só "patrimonio" não cadastra nem edita, nem por insert
    direto), prova 13 (gerente de A não lê bens de B).
- [ ] **Passo 2: Rodar e ver falhar** — `npx vitest run src/test/patrimonio-regras.test.ts`:
  FAIL porque `@/lib/patrimonio/regras` não existe. SQL: erro, tabela não existe.
- [ ] **Passo 3: Implementar** — migração 0012 mostrada e aplicada após o sim; telas Bens, Novo,
  Ficha com `Painel`, `Campo`, `Seletor`, `Tabela`, `Cartao`, `PilulaSituacao`; "Gravar"
  desabilitado durante a gravação; aviso de nº de série repetido com link para o bem.
- [ ] **Passo 4: Rodar e ver passar** — `npx vitest run` e o SQL. Esperado: PASS.
- [ ] **Passo 5: Commit**

### Parte 2: Etiquetas Pimaco 6180 (Carta) e térmica

**Arquivos:**
- Mudar: `package.json`, `bun.lock` — `qrcode` 1.5.4 (gera o QR em SVG, no navegador).
- Criar: `src/lib/patrimonio/etiquetas.ts` — `FORMATOS`, `paginasDeEtiquetas(bens, formato)`.
- Criar: `src/routes/gestao.patrimonio.etiquetas.tsx` — escolha, formato e página de impressão.
- Criar: `drizzle/migrations/0013_patrimonio_etiquetas.sql` — função
  `patrimonio_etiquetas_impressas(ids)` (tira da lista de reimpressão e grava no histórico).
- Prova: `src/test/patrimonio-etiquetas.test.ts`.

**Encaixa:**
- Usa: `formatarTombamento`, `useBens`.
- Entrega: `paginasDeEtiquetas(bens, "a4-6180" | "termica-50x30") -> Pagina[]` com posição em mm.

- [ ] **Passo 1: Provas que falham** — prova 15: 31 bens na Pimaco 6180 → 2 páginas (30 + 1), cada
  etiqueta 66,7 × 25,4 mm nas posições da 6180; térmica → 1 bem por página de 50 × 30 mm; cada
  etiqueta traz QR = "000123", número, nome (cortado em 2 linhas) e empresa.
- [ ] **Passo 2: Ver falhar** — `npx vitest run src/test/patrimonio-etiquetas.test.ts`: FAIL,
  módulo não existe.
- [ ] **Passo 3: Implementar** — página com `@page { size }` e `@media print` que esconde o site;
  só preto no branco.
- [ ] **Passo 4: Ver passar** — `npx vitest run`. PASS.
- [ ] **Passo 5: Commit**

### Parte 3: Inventário pela câmera

**Arquivos:**
- Mudar: `package.json`, `bun.lock` — `qr-scanner` 1.4.2 (câmera no Android e no iPhone).
- Criar: `src/lib/patrimonio/inventario.ts` — `lerNumero(texto) -> number | null`,
  `classificarLeitura(...)`.
- Criar: `drizzle/migrations/0014_patrimonio_inventario.sql` — `patrimonio_inventarios`,
  `patrimonio_leituras` (chave inventário + bem), funções `patrimonio_abrir_inventario`,
  `patrimonio_ler` (devolve encontrado, já lido, outra empresa, não existe ou baixado),
  `patrimonio_sem_etiqueta`, `patrimonio_fechar_inventario`.
- Criar: `src/routes/gestao.patrimonio.inventario.tsx`.
- Prova: `src/test/patrimonio-inventario.test.ts`, `supabase/testes/patrimonio_acessos.sql`.

**Encaixa:**
- Usa: `useBens`, `PilulaSituacao`, `Cartao`.
- Entrega: inventário aberto por empresa e relatório ao fechar.

- [ ] **Passo 1: Provas que falham** — prova 16: "000123", "123", " 123 " e o texto do QR
  viram 123; "abc" vira null. SQL: prova 7 (ler duas vezes conta uma), prova 8 (bem de outra
  empresa avisa e não conta), prova 9 (fechar lista não encontrados sem baixar), prova 10
  ("sem etiqueta" só oferece não lidos da empresa e marca para reimprimir).
- [ ] **Passo 2: Ver falhar** — `npx vitest run src/test/patrimonio-inventario.test.ts`: FAIL.
- [ ] **Passo 3: Implementar** — câmera com `qr-scanner`; campo de número sempre visível (leitor
  USB 2D ou digitação); câmera negada mostra a frase do combinado e a digitação segue.
- [ ] **Passo 4: Ver passar** — `npx vitest run` e o SQL. PASS. Teste da câmera no celular
  fica com a pessoa.
- [ ] **Passo 5: Commit**

### Parte 4: Transferências entre empresas

**Arquivos:**
- Criar: `drizzle/migrations/0015_patrimonio_transferencias.sql` — `patrimonio_transferencias`,
  leitura do bem em trânsito também pelo destino, funções `patrimonio_transferir`,
  `patrimonio_receber`, `patrimonio_cancelar_transferencia`.
- Criar: `src/routes/gestao.patrimonio.transferencias.tsx`; mudar a ficha (botão Transferir).
- Prova: `supabase/testes/patrimonio_acessos.sql`.

- [ ] **Passo 1: Provas que falham** — SQL: prova 2 (tombamento igual depois de recebido),
  prova 11 (em trânsito continua da origem; recebido é do destino; cancelado volta), prova 13
  (origem e destino veem o bem em trânsito; terceira empresa não), prova 14 (só o destino
  recebe), bem em trânsito não é editado, transferido de novo nem baixado.
- [ ] **Passo 2: Ver falhar** — SQL: erro, função não existe.
- [ ] **Passo 3: Implementar** — migração 0015 após o sim; listas "A receber" e "Enviadas".
- [ ] **Passo 4: Ver passar** — SQL e `npx vitest run`. PASS.
- [ ] **Passo 5: Commit**

### Parte 5: Baixa e resumo

**Arquivos:**
- Criar: `drizzle/migrations/0016_patrimonio_baixa.sql` — função `patrimonio_baixar`.
- Mudar: `src/lib/patrimonio/regras.ts` — `resumoPatrimonio(bens, hoje)`.
- Criar: `src/routes/gestao.patrimonio.resumo.tsx`; mudar a ficha (botão Dar baixa).
- Prova: `src/test/patrimonio-regras.test.ts`, `supabase/testes/patrimonio_acessos.sql`.

- [ ] **Passo 1: Provas que falham** — prova 5: baixado não entra no resumo e para de depreciar;
  resumo por empresa e categoria soma compra, acumulada e atual. SQL: só "gerenciar" dá baixa.
- [ ] **Passo 2: Ver falhar** — `npx vitest run src/test/patrimonio-regras.test.ts`: FAIL.
- [ ] **Passo 3: Implementar** — migração 0016 após o sim; tela Resumo com `Cartao` e `Tabela`.
- [ ] **Passo 4: Ver passar** — `npx vitest run` e o SQL. PASS.
- [ ] **Passo 5: Commit**

## Provas do combinado → parte

1 → P1 · 2 → P4 · 3 → P1 · 4 → P1 · 5 → P1 e P5 · 6 → P1 · 7 → P3 · 8 → P3 · 9 → P3 · 10 → P3 ·
11 → P4 · 12 → P1 (e P4, P5) · 13 → P1 e P4 · 14 → P4 · 15 → P2 · 16 → P3
