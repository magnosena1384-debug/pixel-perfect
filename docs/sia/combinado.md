# Combinado — Patrimônio

Rodada 2. O combinado do RH (rodada 1) está em `docs/sia/combinados/rh.md`.

## 1. Quem usa e o que precisa fazer

- **Administrativo / financeiro**: cadastra cada bem (equipamento, móvel, veículo…), imprime as
  etiquetas, transfere bens entre as empresas do grupo, dá baixa e acompanha o valor atual
  depois da depreciação.
- **Gerente de posto**: confere o inventário da própria empresa lendo as etiquetas com a câmera
  do celular, marca o que está com defeito e confirma o recebimento de bens transferidos para lá.
- O acesso segue a tela **Admin → Acessos**, com dois módulos novos por empresa:
  - **Patrimônio**: ver os bens da empresa, fazer o inventário e confirmar recebimento de
    transferência.
  - **Patrimônio – gerenciar**: cadastrar, editar, imprimir etiquetas, dar baixa e enviar
    transferências. Quem gerencia também vê.
  - O admin tem os dois em todas as empresas.

## 2. Deu certo quando

O administrativo cadastra um equipamento, imprime a etiqueta com o tombamento e cola no bem; o
gerente lê essa etiqueta com a câmera do celular no inventário e o bem aparece como encontrado;
o bem transferido para outra empresa só passa a ser dela quando ela confirma; e o resumo mostra o
valor atual de cada empresa depois da depreciação.

## 3. Não vamos fazer agora

- **Foto e nota fiscal do bem**: não há onde anexar arquivo no cadastro.
- **Ligação com a aba Manutenção**: o histórico de inspeção dos equipamentos continua separado do
  patrimônio.
- **Depreciação fiscal separada da contábil**: há uma depreciação só, em linha reta.
- **Exportar para a contabilidade (Excel ou PDF)**: as telas mostram os números, sem gerar
  arquivo.
- **Importar uma planilha de bens já existentes**: o cadastro inicial é feito bem a bem na tela.
- **Valor residual**: todo bem deprecia até zero.

## 4. O que o sistema faz

Uma aba **Patrimônio** na Gestão, para quem tem o módulo em ao menos uma empresa.

### Bens

- Lista dos bens das empresas que a pessoa pode ver, com filtros por empresa, setor, categoria e
  situação, e busca por tombamento, nome, marca, modelo ou nº de série.
- Cada linha: tombamento, nome, empresa e setor, situação, valor atual.

### Cadastrar e editar bem (quem gerencia)

- Campos: nome/descrição, categoria, marca, modelo, nº de série (opcional, recomendado), empresa,
  setor, data de compra, valor de compra, vida útil em anos.
- **Categorias** e vida útil sugerida (pode ser trocada em cada bem): Bombas e equipamentos de
  pista 10 anos; Máquinas e equipamentos 10; Móveis e utensílios 10; Informática 5; Veículos 5;
  Ferramentas 5; Outros 10.
- O **tombamento** é gerado pelo sistema: número sequencial com 6 dígitos (ex.: `000123`), único no
  grupo inteiro, que nunca se repete nem muda — nem quando o bem troca de empresa.
- Se o nº de série digitado já existe em outro bem, o sistema avisa e mostra qual é, antes de
  gravar.
- A empresa só é escolhida no cadastro. Depois, o bem muda de empresa **só por transferência**;
  editar troca o setor e os outros dados.

### Ficha do bem

- Os dados, a situação, o **valor atual** e a **depreciação acumulada** até hoje.
- O **histórico**: cadastro, mudanças de setor, transferências (quem enviou, quem recebeu, quando),
  inventários em que foi encontrado ou não, etiquetas reimpressas e baixa.
- Botões (quem gerencia): editar, imprimir etiqueta, transferir, dar baixa.

### Etiquetas (quem gerencia)

- Escolher um ou vários bens e imprimir pelo navegador em:
  - **Folha A4 Pimaco 6180**: 30 etiquetas por folha, 25,4 × 66,7 mm.
  - **Térmica 50 × 30 mm**: uma etiqueta por bem.
- Cada etiqueta tem: QR code com o número do tombamento, o número escrito, o nome do bem e o nome
  da empresa.
- **Etiquetas para reimprimir**: lista dos bens marcados no inventário como "etiqueta perdida",
  para imprimir de uma vez; ao imprimir, saem da lista e a reimpressão entra no histórico.

### Inventário (quem tem Patrimônio na empresa)

1. Abre um inventário da empresa (um aberto por empresa de cada vez).
2. Lê as etiquetas: pela **câmera do celular** (QR code), por **leitor de código USB** ou
   **digitando** o número. Cada leitura mostra o bem e marca como encontrado, com bip ou vibração.
3. Pode marcar o bem lido como **com defeito**.
4. **Bem sem etiqueta**: mostra os bens da empresa ainda não lidos neste inventário, filtráveis por
   setor e busca; ao escolher um, ele conta como encontrado e vai para "Etiquetas para reimprimir".
5. **Fechar inventário**: relatório com encontrados, **não encontrados**, com defeito e lidos de
   outra empresa. Bem não encontrado não sofre baixa automática.

Regras da leitura:
- Ler o mesmo bem duas vezes conta uma vez.
- Ler um bem de outra empresa (ou em trânsito) mostra um aviso com a empresa dele e não transfere.
- Ler um número que não existe ou de um bem baixado mostra o aviso e não conta.

### Transferências

- **Enviar** (quem gerencia na empresa de origem): escolhe o bem e a empresa de destino do grupo;
  o bem fica **em trânsito** e aparece para a empresa de destino em "A receber".
- **Receber** (quem tem Patrimônio no destino): confirma o recebimento; só então o bem passa a ser
  da empresa de destino.
- **Cancelar** (quem gerencia na origem): enquanto estiver em trânsito, o bem volta para a origem.
- Bem em trânsito não pode ser editado, transferido de novo nem baixado.

### Baixa (quem gerencia)

- Motivo (venda, descarte, furto/perda, cadastro duplicado), data e observação.
- O bem baixado para de depreciar na data da baixa, sai do inventário e das etiquetas, e continua
  na lista com o filtro "Baixados".

### Depreciação

- Linha reta, mês a mês: depreciação mensal = valor de compra ÷ (vida útil em anos × 12).
- Conta os **meses completos** desde a data de compra até hoje (ou até a data da baixa).
- Valor atual = valor de compra − depreciação acumulada, nunca abaixo de zero.

### Resumo

- Por empresa e por categoria: quantidade de bens, valor de compra, depreciação acumulada e valor
  atual (sem os baixados). Mostra só as empresas que a pessoa pode ver.

## 5. O que fica guardado, e quem vê

| Informação | Quem cria / altera | Quem lê | Quem apaga |
| --- | --- | --- | --- |
| Bem (dados, empresa, setor, situação) | Patrimônio – gerenciar na empresa do bem | Patrimônio na empresa do bem | ninguém: bem sai por baixa |
| Sequência do tombamento | o sistema | — | ninguém |
| Transferência (origem, destino, quem enviou/recebeu, datas, situação) | envio: gerenciar na origem; recebimento: Patrimônio no destino; cancelamento: gerenciar na origem | Patrimônio na origem ou no destino | ninguém |
| Inventário e suas leituras | Patrimônio na empresa | Patrimônio na empresa | ninguém |
| Histórico do bem (cadastro, mudanças de setor, etiquetas, baixa) | o sistema, a cada ação | quem vê o bem | ninguém |

- **Cada empresa só vê os seus bens.** O gerente do Posto A não vê bens do Posto B, nem chamando
  o banco direto. Bem em trânsito é visto pelas duas empresas da transferência.
- Bem transferido: o histórico anterior continua visível para a nova empresa.

## 6. Estados

- **Deu certo**: ao gravar um bem, "Bem 000123 cadastrado"; ao fechar inventário, o relatório; ao
  receber, "Bem 000123 agora é de <empresa>".
- **Vazio**: empresa sem bens mostra "Nenhum bem cadastrado nesta empresa" e, para quem gerencia,
  o botão Cadastrar. Inventário sem leituras mostra "Aponte a câmera para uma etiqueta ou digite o
  número".
- **Erro**: falha ao gravar mostra a mensagem e mantém o que foi digitado; câmera negada ou sem
  câmera mostra "Não foi possível usar a câmera. Digite o número ou use o leitor." e a digitação
  continua funcionando.
- **Sem permissão**: sem Patrimônio em nenhuma empresa, a aba não aparece; abrindo o endereço,
  "Você não tem acesso ao Patrimônio nesta empresa". Sem "gerenciar", os botões de cadastrar,
  editar, etiquetas, transferir e baixa não aparecem.
- **Carregando**: "Carregando…" enquanto busca; botões que gravam ficam desabilitados até terminar.

## 7. Provas

Cada linha vira teste.

1. Dois bens cadastrados em empresas diferentes recebem tombamentos seguidos e diferentes
   (ex.: `000001` e `000002`), mesmo cadastrados ao mesmo tempo.
2. O tombamento não muda quando o bem é transferido.
3. Depreciação: bem de R$ 12.000,00 com vida útil de 10 anos, comprado em 15/01/2026, vale
   R$ 11.200,00 em 14/10/2026 (8 meses completos) e R$ 11.100,00 em 15/10/2026 (9 meses).
4. O valor atual nunca fica abaixo de zero (bem de 5 anos comprado há 7 anos vale R$ 0,00).
5. Bem baixado para de depreciar na data da baixa e não entra no resumo.
6. Nº de série repetido é avisado antes de gravar.
7. Inventário: ler o mesmo bem duas vezes conta uma vez.
8. Inventário: ler bem de outra empresa avisa e não conta como encontrado nem transfere.
9. Fechar inventário lista como não encontrados os bens da empresa que não foram lidos, sem
   dar baixa neles.
10. "Bem sem etiqueta" só oferece bens da empresa ainda não lidos e manda o escolhido para
    "Etiquetas para reimprimir".
11. Transferência: enquanto em trânsito, o bem continua da origem; depois de recebido, é do destino;
    cancelada, volta para a origem.
12. Quem só tem Patrimônio (sem gerenciar) não cadastra, não edita, não envia transferência e não
    dá baixa, nem chamando o banco direto.
13. O gerente do Posto A não lê bens, inventários nem transferências do Posto B, nem chamando o
    banco direto; um bem em trânsito de A para B é visto pelos dois.
14. Só a empresa de destino confirma o recebimento.
15. A etiqueta A4 coloca 30 etiquetas por folha no tamanho 25,4 × 66,7 mm, e a térmica uma por
    página de 50 × 30 mm, cada uma com o QR do tombamento, o número, o nome do bem e a empresa.
16. O número lido do QR (ou digitado com ou sem zeros à esquerda, ex.: `123`) encontra o bem
    `000123`.

## 8. De onde veio

Nenhum dado de fora entrou. A pasta `docs/contexto/` só tem os relatórios do QuarkRH, que são do RH.
A vida útil por categoria, o tamanho das etiquetas (Pimaco 6180 por padrão, térmica 50 × 30 mm) e
as regras vieram desta conversa.

## 9. Escolhas

Ver `docs/sia/escolhas.md`. Projeto existente: TanStack Start, Supabase (postos-lemon), Vitest,
Vercel.
