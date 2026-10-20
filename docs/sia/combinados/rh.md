# Combinado — RH (painel do QuarkRH)

Rodada 1 de 2. O Patrimônio é a rodada 2 e tem combinado próprio.

## 1. Quem usa e o que precisa fazer

- **RH e diretoria**: veem todas as unidades. Sobem os relatórios do QuarkRH, fecham o mês,
  comparam os postos e abrem a ficha de qualquer colaborador.
- **Gerente de posto**: vê só a equipe da própria unidade. Acompanha no dia a dia quem faltou ou
  atrasou, e as médias de cada pessoa por mês.
- O acesso segue a tela **Admin → Acessos** que já existe, com dois módulos novos por unidade:
  - **RH**: ver o painel de RH daquela unidade.
  - **RH – importar**: subir os relatórios do QuarkRH daquela unidade.
  - O admin tem os dois em todas as unidades.

## 2. Deu certo quando

O RH sobe os três relatórios do QuarkRH de um posto, e o painel mostra, para aquele posto e para
cada colaborador, as horas trabalhadas, as faltas sem justificativa, os atrasos e a pontualidade,
com os mesmos números que o QuarkRH mostra no período.

## 3. Não vamos fazer agora

- **Advertências e suspensões**: não aparecem no painel. Nenhum relatório exportado traz esses
  dados.
- **Custo médio por colaborador** (salário e horas extras em R$): não aparece. Nenhum relatório
  exportado traz salário.
- **Ligação automática com o QuarkRH**: o painel só se atualiza quando alguém sobe a planilha.
- **Lançar ocorrências pelo painel**: não há botão para registrar falta, atestado ou advertência.
  O painel só lê o que vem do QuarkRH.
- **Alertas**: ninguém recebe aviso quando alguém falta ou atrasa. É preciso abrir o painel.
- **Patrimônio** (etiquetas, inventário, tombamento, depreciação): a aba ainda não existe.

## 4. O que o sistema faz

### Importar (quem tem "RH – importar")

1. Na aba **RH → Importar**, a pessoa escolhe a **unidade** e o arquivo Excel exportado do QuarkRH
   (o QuarkRH já é filtrado por posto antes de exportar).
2. O painel reconhece sozinho qual dos três relatórios é, pelas colunas:
   - **Frequência Analítico**: uma seção por colaborador (o nome numa linha, depois os dias), com
     as colunas Dia, Jornada, Ent./Sai. (2 ou 3 pares), Diurna, Noturna, Extras Normais, H.N.,
     Extras 100%, Descontos e Observações.
   - **Irregularidades – Completo**: uma linha por colaborador e tipo, com Data Inicial,
     Data Final, Nome, CPF, Cargo, Setor, Vínculo, Irregularidade e as Datas em que ocorreu.
   - **Banco de Horas – Sintético**: Colaborador, Data de Admissão, Setor, Crédito, Débito e
     Saldo, com a data do saldo no cabeçalho.
3. Antes de gravar, mostra uma **prévia**: qual relatório é, o período, quantos colaboradores e
   dias ou ocorrências vieram, e as linhas que não deu para ler (com o motivo).
4. Ao confirmar, grava. Subir de novo o mesmo relatório da mesma unidade **substitui** os dados
   daquele período, sem duplicar. Os dias fora do período do arquivo continuam como estavam.

### Painel (quem tem "RH")

- **Filtros**: período (mês ou de/até), unidade (só as que a pessoa pode ver), setor e colaborador.
- **Cartões** do período filtrado:
  - **Horas trabalhadas**: Diurna + Noturna + Extras Normais + Extras 100%, somadas.
  - **Média de horas por colaborador**: horas trabalhadas ÷ colaboradores com ponto no período.
  - **Faltas sem justificativa**: as datas marcadas como FALTA nas Irregularidades.
  - **Atestados**: dias do ponto com "atestado" nas Observações.
  - **Atrasos**: quantidade de datas marcadas como ATRASO nas Irregularidades, e os **minutos**:
    a coluna Descontos do ponto nesses dias. Para o QuarkRH, ATRASO é o dia com desconto parcial,
    seja por chegar tarde ou por sair cedo sem compensar; quem entrou 08:18 e compensou no fim do
    dia não é marcado.
  - **Pontualidade**: % dos dias trabalhados (dias com batida) que não estão marcados como ATRASO.
  - **Horas extras** e **saldo do banco de horas**.
- **Horas por setor**: horas trabalhadas de cada setor (Pista, Operacional…), com a média por
  colaborador do setor.
- **Comparar postos**: uma linha por unidade com os números dos cartões lado a lado.
- **Por colaborador**: uma linha por pessoa com os mesmos números, mais o **ticket médio de vendas**
  dela no webPosto no período (só quando os cupons do webPosto foram importados).
- **Ficha do colaborador**: clicando na pessoa, as médias **mês a mês** (horas, faltas, atrasos,
  minutos de atraso, pontualidade) e a lista de dias com falta, atraso, atestado, férias ou abono.

### Como as peças se juntam

- O colaborador é identificado pelo **CPF** quando ele aparece (Irregularidades). A Frequência e o
  Banco de Horas só trazem o nome; nesses, a pessoa é achada pelo **nome na mesma unidade**,
  ignorando acentos, maiúsculas e espaços sobrando.
- O **setor** vem das Irregularidades ou do Banco de Horas. Quem não aparece em nenhum dos dois fica
  em "Sem setor".
- O **ticket médio de vendas** junta a pessoa com o funcionário do webPosto pelo CPF; sem CPF, pelo
  nome. É o total dos cupons dela ÷ número de cupons, no período.

## 5. O que fica guardado, e quem vê

| Informação | Quem cria | Quem lê | Quem apaga |
| --- | --- | --- | --- |
| Dias de ponto (jornada, batidas, horas, descontos, observação) | quem tem "RH – importar" na unidade, pela importação | quem tem "RH" na unidade | a reimportação do mesmo período substitui |
| Irregularidades (tipo e data, com nome, CPF, cargo, setor) | idem | idem | idem |
| Banco de horas (crédito, débito, saldo, data do saldo) | idem | idem | a reimportação substitui o da unidade |
| Registro de cada importação (quem, quando, arquivo, período, quantidades) | o sistema | quem tem "RH" na unidade | ninguém |

- **Cada unidade só é vista por quem tem acesso a ela.** O gerente do Posto A não vê ninguém do
  Posto B, nem chamando o banco direto.
- O **CPF** aparece na ficha do colaborador para quem tem "RH" naquela unidade, e em nenhum outro
  lugar.
- O arquivo Excel não é guardado: só os dados lidos dele.

## 6. Estados

- **Deu certo**: depois de confirmar a importação, uma mensagem diz o que entrou ("Frequência de
  01/10 a 19/10: 13 colaboradores, 247 dias") e o painel já mostra os números.
- **Vazio**: unidade sem nada importado no período mostra "Nenhum dado de RH neste período" e, para
  quem pode importar, o atalho para Importar.
- **Erro no arquivo**: arquivo que não é um dos três relatórios mostra "Este arquivo não parece um
  relatório do QuarkRH (Frequência, Irregularidades ou Banco de Horas)" e não grava nada. Linhas
  que não deu para ler aparecem na prévia; o resto pode ser gravado.
- **Sem permissão**: sem "RH" na unidade, a aba RH não aparece; abrindo o endereço direto, aparece
  "Você não tem acesso ao RH nesta unidade". Sem "RH – importar", o botão Importar não aparece.
- **Carregando**: o painel mostra "Carregando…" enquanto busca os dados.

## 7. Provas

Cada linha vira teste.

1. A Frequência de exemplo é lida com 13 colaboradores e 247 dias, aceitando seções com 2 ou 3
   pares de batidas.
2. Horas trabalhadas de um dia = Diurna + Noturna + Extras Normais + Extras 100% (ex.: feriado com só
   04:09 de Extras 100% conta 04:09).
3. A soma de cada coluna (Diurna, Noturna, Extras Normais, Extras 100%, Descontos) de um
   colaborador bate com a linha "Somatório" dele no próprio relatório.
4. As Irregularidades de exemplo viram uma ocorrência por data (ex.: 2 FALTAS de um colaborador = 2
   datas), com CPF, cargo e setor.
5. As faltas de um colaborador nas Irregularidades caem nos dias sem batida e sem observação do ponto.
6. Minutos de atraso: um colaborador com ATRASO em dois dias, com Descontos 00:53 e 01:31 no ponto,
   soma 144 minutos; um dia de FALTA (Descontos 08:00) não entra nessa conta.
7. Pontualidade = dias trabalhados sem ATRASO ÷ dias trabalhados.
8. Dia com "Atestado" na observação conta como atestado; "Férias", "Feriado" e "Abonada" não contam
   como falta nem como atestado.
9. O Banco de Horas de exemplo é lido com 13 colaboradores, com saldo negativo ("-01:12") aceito.
10. Um arquivo qualquer (que não é dos três) é recusado sem gravar nada.
11. Importar duas vezes a mesma Frequência da mesma unidade não duplica dias.
12. O gerente com "RH" só no Posto A não lê nenhum dado do Posto B, nem chamando o banco direto.
13. Quem não tem "RH – importar" não consegue gravar dados de RH, nem chamando o banco direto.
14. O nome com acento ou espaço diferente entre a Frequência e as Irregularidades vira a mesma pessoa.

## 8. De onde veio

- `docs/contexto/quarkrh/RelatorioFrequenciaAnalitico.xls`: colunas, seções por colaborador, 2 ou 3
  pares de batidas, observações usadas (Férias, Feriado, Abonada, Banco de Horas), 13 colaboradores e
  247 dias, período 01/10 a 19/10/2026.
- `docs/contexto/quarkrh/Relatório de Irregularidades - Completo (1).xls`: colunas, tipos de
  irregularidade (FALTA, ATRASO, HORA_EXTRA, INTRAJORNADA, JORNADA_MAXIMA, ADIANTAMENTO) e o formato
  das datas.
- `docs/contexto/quarkrh/Relatório Sintético - Banco de Horas 2º SEMESTRE 2026.xls`: colunas, setor
  (Pista, Operacional), saldo com sinal e a data do saldo no cabeçalho.

Nenhum desses arquivos traz posto, advertência, suspensão, atestado no período ou salário.

## 9. Escolhas

Ver `docs/sia/escolhas.md`. Projeto existente: TanStack Start, Supabase (postos-lemon), Vitest,
Vercel.
