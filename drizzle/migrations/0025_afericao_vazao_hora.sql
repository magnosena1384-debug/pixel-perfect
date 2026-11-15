-- Aferição de bomba e bico: resultado da vazão alta e da vazão baixa (valores lidos no balde
-- aferidor, em ml; tolerância de mais ou menos 100 ml) e o momento exato da aferição.
-- As colunas ficam vazias nas aferições que não trazem esses dados.
alter table public.manutencao_afericoes
  add column realizada_em timestamptz,
  add column vazao_alta_ml integer,
  add column vazao_baixa_ml integer;
