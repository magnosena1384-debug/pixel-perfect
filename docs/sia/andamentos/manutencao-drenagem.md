# Andamento — Drenagem de tanque e aferição de bombas (Manutenção)

Combinado: `docs/sia/combinados/manutencao-drenagem.md`. Pausado em 2026-11-13 a pedido.

## Já feito e provado

- Migração `0024_manutencao_drenagem_afericao.sql` **aplicada** no banco (tabelas
  `manutencao_drenagens` e `manutencao_afericoes`, acesso por `pode_gestao(..., 'manutencao')`).
- Dados do Posto Seguro **importados**: 291 drenagens e 261 aferições (conferido no banco).
  Cópia em `.postoseguro/manutencao.json` (fora do Git).
- Código das duas abas escrito (`src/components/manutencao/`, `src/lib/manutencao-*.ts`,
  `src/routes/gestao.manutencao.tsx`), com 110 testes passando **antes** do último ajuste.
- A prova de acesso `supabase/testes/manutencao_acessos.sql` (esperado `ok=12`): o resultado
  não foi conferido por mim; a pessoa disse que os comandos foram rodados.

## Em andamento (a árvore de trabalho NÃO compila até terminar)

Ajuste para a tela usar as perguntas exatas do formulário do Posto Seguro:

- "Homogêneo, límpido e isento de material particulado?" → `aspecto_normal` (**Sim é o normal**).
- "Presença de água?" → `tem_agua` (**Não é o normal**).
- "Água no medidor/mm?" → `agua_no_medidor`, guardado em `dados_origem.pres_agua_mm`
  (**Não é o normal**).

Feito neste ajuste: tipo `Drenagem` (campo `agua_no_medidor`), `PRODUTOS_DIESEL`,
`manutencao-dados.ts` (lê e grava o medidor em `dados_origem`), fixture do teste.
**Falta** em `src/components/manutencao/DrenagemTanque.tsx`:

1. `vazio()`: `aspecto: "Sim"` e novo `aguaMedidor: "Não"`.
2. `enviar`: `aspecto_normal: form.aspecto === "Sim"` e `agua_no_medidor: form.aguaMedidor === "Sim"`.
3. Formulário: rótulos "Presença de água?", "Homogêneo, límpido e isento de material
   particulado?" (Sim/Não), novo campo "Água no medidor (mm)?", "Volume drenado (L)".
4. Tabela: colunas "Volume drenado", "Límpido" (Sim/Não) e "Medidor".

Depois: `prettier`, `tsc` (`node node_modules/typescript/bin/tsc --noEmit`), `eslint` nos arquivos
mexidos, `vitest` (pelo PowerShell, com `C:` maiúsculo), commit e push; e conferir a aba no ar.

## Pontos para a pessoa conferir

- Postos com zero no Posto Seguro: IV (drenagem e aferição), VIII (drenagem), VI, VII e IX
  (aferição). Pode ser real; confirmar na tela do Posto Seguro.
- 28 drenagens com "Presença de água = sim" têm volume de água 0 e medida "não houve": é como
  está lá; mantido.
- RG do responsável é guardado junto de cada drenagem; perguntar se quer manter.

## Nada foi enviado

Nada disto foi commitado nem enviado ao site. O site no ar ainda não tem as abas novas.
