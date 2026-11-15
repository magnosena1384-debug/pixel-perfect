# Andamento — Drenagem de tanque e aferição de bombas (Manutenção)

## Estado em 2026-11-15 (leia primeiro; o resto do arquivo é o histórico)

No ar: abas Drenagem de tanque Diesel e Aferição de bombas e bicos; relatório por lançamento com
uma só assinatura (responsável pela análise / pela aferição); aferição com hora, vazão alta e vazão
baixa (±100 ml) e resultado; evidências em fotos (câmera ou galeria) nas Rotinas administrativas e
na Manutenção (migrações 0024, 0025 e 0026, todas aplicadas).

**Vazões das aferições antigas: parado de propósito.** Só 51 das 261 aferições importadas têm
vazão confirmada (conferidas com os dados do site: 48 iguais, 0 diferentes). As outras 210 têm a
hora certa e a vazão como "Não informado". O Posto Seguro tem esses números (o relatório de
27/04/26 do posto II mostra os 18 bicos abrindo à mão), mas `scripts/postoseguro-copiar-vazoes.mjs`
não consegue abrir esses relatórios pelo clique automático: 7 rodadas, sempre as mesmas 51.
Se for retomar: antes de qualquer nova leitura completa, fazer um teste pequeno que registre, a
cada clique, o que a tela passou a mostrar.

Cuidados aprendidos (valem para qualquer leitura nova):
- A data do relatório vem **impressa na folha** ("Elaborado por … Data: dd/mm/aaaa"); nunca usar
  a data do cartão clicado, porque a tela às vezes ainda mostra o relatório anterior.
- Os valores positivos vêm com sinal de mais ("ALTA: +20").
- Cada bico só ganha o par ALTA/BAIXA do seu próprio bloco.
- Conferir sempre contra a segunda fonte (respostas do questionário nos dados do site) e contra
  uma imagem conhecida (27/04/26, posto II, bicos 1 a 18) antes de gravar no banco.
- Um comando de importar rodou com a leitura errada e gravou 212 vazões erradas; foram zeradas
  com `scripts/limpar-vazoes.mjs`. Só pedir o comando de importar depois da conferência.

Em aberto: o resultado da prova `supabase/testes/evidencias_acessos.sql` (esperado `ok=15`) e o
teste da câmera num celular real; os postos com zero lançamentos (IV, VIII em drenagem; VI, VII
e IX em aferição) a conferir no Posto Seguro; se o RG do responsável deve continuar guardado.

---

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
