# Combinado — Drenagem de tanque e aferição de bombas (Manutenção e inspeção)

Forma curta. Nasce do pedido de trazer do Posto Seguro as drenagens de tanque e as aferições de
bombas e bicos dos 9 postos. O sim foi dado na conversa (2026-11-13); a escolha das aferições foi
"só data e responsável".

## O que muda

- Na tela **Manutenção e inspeção** entram duas abas ao lado das categorias:
  - **Drenagem de tanque Diesel**: lista dos lançamentos do posto (data, tanque, produto, volume da
    amostra, volume de água, se havia água, aspecto, cor, medida adotada, responsável e RG), com
    filtro de período, resumo por tanque (última drenagem, em dia ou atrasada) e formulário para
    lançar daqui para frente. Período da drenagem: **semanal** (7 dias).
  - **Aferição de bombas e bicos**: um cartão por bomba e bico, com a última aferição, o
    responsável, a próxima (**quinzenal**, 15 dias), a situação e o histórico; formulário para
    registrar uma aferição nova.
- Cada aba guarda os lançamentos numa **tabela própria** (são centenas por posto), com acesso só
  para quem tem o módulo Manutenção naquele posto.
- **Importação** das drenagens e aferições já lançadas no Posto Seguro nas 9 unidades. Cada registro
  importado guarda o id de origem (não duplica se rodar de novo).

## Não entra agora

- Respostas do questionário de aferição, vazão alta e baixa e fotos: ficam no Posto Seguro.
- Aviso de drenagem ou aferição atrasada nas **Notificações** (a aba mostra a situação).
- Editar um lançamento já gravado (por enquanto só lançar e excluir).

## Deu certo quando

O gerente de um posto abre Manutenção, vê as drenagens do posto vindas do Posto Seguro, lança a
drenagem da semana, e a aba mostra o tanque como "em dia"; e as aferições dos bicos aparecem com a
data e o responsável de cada uma.
