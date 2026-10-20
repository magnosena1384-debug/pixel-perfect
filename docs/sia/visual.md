# Cara — Postos Lemon

A cara já existia no código antes deste arquivo: ele registra o que está em `src/styles.css`
(identidade Lemon) e nas telas da Gestão. A consulta automática de estilo não rodou (sem Python
na máquina); a fonte é o próprio código.

## Mestre

- **Padrão de página**: área logada com `SiteHeader`, fundo `bg-muted` (creme), título grande em
  maiúsculas, abas em pílula (`rounded-full`, ativa em `bg-ink text-cream`) e conteúdo em blocos
  `Painel` (`rounded-3xl bg-card p-6`), largura máxima `max-w-6xl`, gutter 16px (`px-4`).
- **Estilo**: plano, cartões arredondados grandes, sem sombra pesada, sem gradiente (exceto o
  padrão de bolinhas `dot-grid` em capas de marketing, fora da área logada).
- **Cores** (tokens em `src/styles.css`, nunca hex solto):
  - `lime` (primária, destaque e foco), `forest` (secundária), `ink` (texto e cartão escuro),
    `cream` (`muted`, fundo), `card` branco, `destructive` vermelho.
  - Gráficos: `--chart-1` lime, `--chart-2` forest, `--chart-3` ink, `--chart-4`, `--chart-5`.
  - Alerta/atenção: `bg-amber-400 text-black` (já usado em "a vencer").
- **Letras**: Outfit (300–800) para tudo; títulos com `letter-spacing: -0.02em`; rótulo pequeno em
  maiúsculas com a utilidade `eyebrow`. Números em colunas e cartões com `tabular-nums`.
- **Efeitos**: só `hover:bg-background` e foco `ring` lime. Sem animação de entrada em gráfico
  (dados legíveis na hora).
- **Evitar**: cor nova fora dos tokens; ícone emoji; tabela sem rolagem horizontal no celular;
  gráfico sem tabela equivalente; número sem formatação pt-BR.

## Estados (do combinado)

- **Carregando**: texto "Carregando…" em `text-muted-foreground` no lugar do conteúdo; o botão que
  grava mostra "Gravando…" e fica desabilitado até terminar.
- **Vazio**: `Vazio` centralizado com a frase do combinado e, quando couber, o atalho para a ação.
- **Erro**: `Painel` com a frase do erro em linguagem simples; toast `sonner` para falha de ação.
- **Sem permissão**: `Painel` com "Você não tem acesso ao … nesta unidade."; botão que a pessoa não
  pode usar não aparece.
- **Deu certo**: toast de sucesso com o resumo do que entrou; o painel já mostra o dado novo.

## Página: RH

Aba "RH" na barra da Gestão, ao lado das outras, para quem tem o módulo. Dentro dela, duas
sub-abas em pílula: **Painel** e **Importar** (esta só para quem tem "RH – importar").

### Painel

- Linha de filtros num `Painel`: período (mês, ou De/Até), Unidade, Setor, Colaborador
  (`Campo` + `Seletor`/`Input`), em grade `sm:grid-cols-2 lg:grid-cols-5`.
- Cartões (`Cartao`) em grade `grid-cols-2 lg:grid-cols-4`:
  - Horas trabalhadas — `bg-ink text-cream`, com a média por colaborador na linha de baixo.
  - Faltas sem justificativa — `bg-destructive text-destructive-foreground` quando > 0, senão `bg-card`.
  - Atrasos (qtde e minutos) — `bg-amber-400 text-black` quando > 0, senão `bg-card`.
  - Pontualidade — `bg-secondary text-secondary-foreground` (forest), em %.
  - Atestados, Horas extras, Saldo do banco de horas — `bg-card`.
- **Horas por setor**: barras horizontais (forest), com tabela ao lado (setor, colaboradores,
  horas, média).
- **Comparar postos**: `Tabela` (unidade, colaboradores, horas, média, faltas, atrasos, minutos,
  pontualidade, atestados). Só aparece com mais de uma unidade visível.
- **Por colaborador**: `Tabela` com nome (link para a ficha), setor, horas, faltas, atrasos,
  minutos, pontualidade, atestados, ticket médio de vendas ("—" sem webPosto). Ordenada por faltas
  e atrasos, maior primeiro.
- Horas sempre em `HH:MM` (ex.: `102:47`); porcentagem com uma casa (`96,4%`).

### Ficha do colaborador

- Cabeçalho num `Painel`: nome, unidade, setor, cargo e CPF (`eyebrow` para os rótulos).
- Cartões do período, os mesmos do painel.
- **Mês a mês**: linha para horas trabalhadas (forest) e barras para faltas e atrasos
  (destructive e amber), com a `Tabela` equivalente logo abaixo.
- **Dias que contam**: lista em `divide-y` com data, tipo (`SituacaoBadge`-like em pílula:
  Falta vermelho, Atraso âmbar, Atestado/Férias/Abono `bg-muted`) e a observação do QuarkRH.

### Importar

- `Painel` "Importar do QuarkRH": Unidade (`Seletor`), arquivo (`Input type="file"` com rótulo,
  aceita `.xls,.xlsx`). Frase curta dizendo os três relatórios aceitos.
- Depois de escolher o arquivo, `Painel` de **prévia**: tipo do relatório em destaque, período,
  números em cartões pequenos (colaboradores, dias/ocorrências), e, se houver, lista de linhas
  não lidas com o motivo. Botões: "Gravar" (primário, desabilitado enquanto grava) e "Cancelar"
  (ghost).
- Abaixo, "Últimas importações": `Tabela` com data, quem, relatório, período e quantidades.

### Celular (375px)

Filtros empilhados; cartões em 2 colunas; tabelas com rolagem horizontal dentro do `Painel`;
gráficos com altura fixa e barras horizontais.

## Página: Patrimônio

Aba "Patrimônio" na barra da Gestão para quem tem o módulo em alguma empresa. Sub-abas em pílula
(`bg-forest text-secondary-foreground` na ativa, igual ao RH): **Bens**, **Inventário**,
**Transferências**, **Resumo** e, para quem gerencia, **Etiquetas**.

### Situação do bem (pílula, mesmo formato de `SituacaoBadge`)

- Em uso — `bg-primary text-primary-foreground` (lime).
- Com defeito — `bg-amber-400 text-black`.
- Em trânsito — `bg-secondary text-secondary-foreground` (forest).
- Baixado — `bg-muted text-muted-foreground`.

Tombamento sempre em `font-mono tabular-nums` com os 6 dígitos (`000123`).

### Bens

- `Painel` de filtros (Empresa, Setor, Categoria, Situação, Busca) em grade `sm:grid-cols-2
  lg:grid-cols-5`; botão "Cadastrar bem" (`Button` primário) na ação do painel, só para quem gerencia.
- Lista em `Tabela`: tombamento, nome (link para a ficha), empresa · setor, situação (pílula),
  valor atual. Caixa de seleção por linha para quem gerencia ("Imprimir etiquetas", "Transferir").
- Celular: a tabela rola para o lado; a busca fica no topo.

### Cadastrar / editar

- Formulário num `Painel` com `Campo` + `Input`/`Seletor`, grade `sm:grid-cols-2 lg:grid-cols-3`.
  Valor em R$ com `inputMode="decimal"`; datas com `type="date"`; vida útil preenchida pela
  categoria e editável.
- Aviso de nº de série repetido: faixa `border-2 border-amber-400` com link para o bem existente.
- "Gravar" desabilitado e "Gravando…" até terminar.

### Ficha do bem

- Cabeçalho: tombamento grande (`text-3xl font-bold font-mono`), nome, pílula de situação,
  empresa · setor; dados em `dl` com rótulos `eyebrow`.
- `Cartao`s: Valor de compra (`bg-card`), Depreciação acumulada (`bg-card`), Valor atual
  (`bg-ink text-cream`).
- Histórico em lista `divide-y`: data, o que aconteceu, quem.

### Inventário (feito para o celular, 375px primeiro)

- Topo fixo com a empresa, o contador grande "**37** de 120 encontrados" e o botão "Fechar
  inventário".
- Área da câmera em largura total, cantos `rounded-3xl`, com moldura lime marcando onde mirar.
  Abaixo, campo "Número do tombamento" sempre visível (serve para digitar e para o leitor USB),
  com botão "Ler".
- Última leitura num `Cartao`: verde-limão (`bg-primary`) quando encontrado, âmbar quando é de
  outra empresa ou já lido, vermelho (`bg-destructive`) quando não existe ou está baixado. Botão
  "Com defeito" no cartão do bem lido.
- Botão secundário "Bem sem etiqueta" abre a lista dos não lidos com filtro de setor.
- Alvos de toque com no mínimo 44px; bip/vibração opcionais; sem animação (respeita
  `prefers-reduced-motion`).
- Relatório ao fechar: `Cartao`s Encontrados / Não encontrados (`bg-destructive` se > 0) / Com
  defeito (`bg-amber-400`) / De outra empresa, e as listas abaixo.

### Transferências

- Duas listas em `Painel`: "A receber" (com botão "Confirmar recebimento") e "Enviadas em trânsito"
  (com "Cancelar"), mais o histórico recente. Pílula "Em trânsito" (forest).

### Resumo

- `Cartao`s do total (Valor de compra, Depreciação acumulada, Valor atual `bg-ink text-cream`,
  Quantidade de bens) e `Tabela` por empresa e por categoria.

### Etiquetas (impressão)

- Tela: escolher bens (ou "Etiquetas para reimprimir"), formato **Folha Pimaco 6180 (Carta)** ou
  **Térmica 50 × 30 mm**, e "Imprimir" (abre a impressão do navegador).
- Impressão: só preto no branco, sem cabeçalho nem menu do site (`@media print`), tamanho exato
  com `@page`. Em cada etiqueta: QR code à esquerda (altura da etiqueta menos a margem), à direita
  o tombamento em negrito grande `font-mono`, o nome do bem (cortado em 2 linhas) e o nome da
  empresa em letra pequena.

## Peças

- `src/components/gestao/ui.tsx` → `Painel`: bloco branco arredondado com título e ação.
- `src/components/gestao/ui.tsx` → `Campo`: rótulo + campo de formulário.
- `src/components/gestao/ui.tsx` → `Seletor`: select nativo no estilo dos inputs.
- `src/components/gestao/ui.tsx` → `Vazio`: mensagem centralizada de estado vazio.
- `src/components/gestao/ui.tsx` → `SituacaoBadge`: pílula colorida de situação.
- `src/components/ui/chart.tsx` → `ChartContainer`/`ChartTooltip`/`ChartLegend`: base dos gráficos.
- `src/components/ui/button.tsx` → `Button`; `src/components/ui/input.tsx` → `Input`.
- `src/components/gestao/ui.tsx` → `Cartao`: cartão de indicador (rótulo, número grande, detalhe, cor).
- `src/components/gestao/ui.tsx` → `Tabela`: tabela simples com a primeira coluna em negrito e números à direita.
- `src/components/gestao/ui.tsx` → `PilulaSituacao`: pílula da situação do bem (em uso, com defeito, em trânsito, baixado).
- `src/components/gestao/ui.tsx` → `Seletor` aceita também opções `{ valor, rotulo }` quando o que se grava não é o que se lê.
- `src/components/patrimonio/FormularioBem.tsx` → `FormularioBem`: campos do bem, no cadastro e na edição.
