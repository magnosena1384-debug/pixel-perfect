-- Provas do patrimônio no banco (combinado, provas 1, 6, 12 e 13; as partes seguintes acrescentam).
-- Roda pela ligação com o Supabase. Tudo é desfeito no fim pelo `raise exception`, cuja mensagem
-- traz o resultado: RESULTADO ok=<n> falhas=<lista>.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  gestor uuid := gen_random_uuid();  -- gerenciar na A e na B
  gerente_a uuid := gen_random_uuid(); -- só patrimonio na A
  ok int := 0;
  falhas text[] := '{}';
  n int;
  r jsonb;
  t1 bigint;
  t2 bigint;
  bem_b uuid;
  bem_a1 uuid;
  bem_a2 uuid;
  bem_a3 uuid;
  inv uuid;
  r2 jsonb;
  dados jsonb := '{"nome":"Bomba 1","categoria":"Bombas e equipamentos de pista","setor":"Pista","numero_serie":"SN-TESTE-1","data_compra":"2026-01-15","valor_compra_centavos":1200000,"vida_util_anos":10}';
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste Pat A', 900), (ub, 'Teste Pat B', 901);
  insert into auth.users (id, email, aud, role) values
    (gestor, 'gestor-pat@teste.invalid', 'authenticated', 'authenticated'),
    (gerente_a, 'gerente-pat@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gestor, ua, array['patrimonio-gerenciar']),
    (gestor, ub, array['patrimonio-gerenciar']),
    (gerente_a, ua, array['patrimonio']);

  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Prova 1: dois cadastros em empresas diferentes, números seguidos e diferentes.
  t1 := (public.patrimonio_cadastrar(ua, dados) ->> 'tombamento')::bigint;
  r := public.patrimonio_cadastrar(ub, dados || '{"nome":"Cofre","numero_serie":"SN-TESTE-2"}');
  t2 := (r ->> 'tombamento')::bigint;
  bem_b := (r ->> 'id')::uuid;
  if t2 = t1 + 1 then ok := ok + 1; else falhas := falhas || format('p1: tombamentos %s e %s', t1, t2); end if;

  -- Prova 6: nº de série repetido é avisado e não grava; confirmando, grava.
  r := public.patrimonio_cadastrar(ua, dados || '{"numero_serie":" sn-teste-1 "}');
  select count(*) into n from public.patrimonio_bens where unidade_id = ua;
  if r ? 'repetido' and n = 1 then ok := ok + 1; else falhas := falhas || format('p6: %s, %s bens na A', r, n); end if;

  -- Prova 13: o gerente da A não lê bens da B nem o histórico deles.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.patrimonio_bens where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p13: leu %s bens da B', n); end if;
  select count(*) into n from public.patrimonio_historico where bem_id = bem_b;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p13: leu %s históricos da B', n); end if;
  select count(*) into n from public.patrimonio_bens where unidade_id = ua;
  if n = 1 then ok := ok + 1; else falhas := falhas || format('p13: vê %s bens da A, esperava 1', n); end if;

  -- Prova 12: quem só vê não cadastra, não edita, nem direto na tabela.
  begin
    perform public.patrimonio_cadastrar(ua, dados || '{"numero_serie":"SN-TESTE-3"}');
    falhas := falhas || 'p12: gerente cadastrou'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    perform public.patrimonio_editar((select id from public.patrimonio_bens where unidade_id = ua), dados || '{"setor":"Loja"}');
    falhas := falhas || 'p12: gerente editou'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    update public.patrimonio_bens set setor = 'X' where unidade_id = ua;
    get diagnostics n = row_count;
    if n > 0 then falhas := falhas || 'p12: gerente alterou direto na tabela'::text; else ok := ok + 1; end if;
  exception when others then ok := ok + 1;
  end;
  begin
    insert into public.patrimonio_bens (unidade_id, nome, categoria, data_compra, valor_compra_centavos, vida_util_anos)
    values (ua, 'X', 'Outros', '2026-01-01', 1, 1);
    falhas := falhas || 'p12: gerente inseriu direto na tabela'::text;
  exception when others then ok := ok + 1;
  end;

  -- Edição pelo gestor muda o setor e grava no histórico; a empresa não muda por edição.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.patrimonio_editar(bem_b, dados || jsonb_build_object('setor', 'Loja', 'unidade_id', ua));
  select count(*) into n from public.patrimonio_bens where id = bem_b and setor = 'Loja' and unidade_id = ub;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'edição: setor não mudou ou empresa mudou'::text; end if;
  select count(*) into n from public.patrimonio_historico where bem_id = bem_b;
  if n = 2 then ok := ok + 1; else falhas := falhas || format('histórico com %s eventos, esperava 2', n); end if;

  -- Inventário (0014): mais dois bens na A, um que vai sem etiqueta e um que não aparece.
  bem_a2 := (public.patrimonio_cadastrar(ua, dados || '{"nome":"Cofre A","numero_serie":"SN-TESTE-4"}') ->> 'id')::uuid;
  bem_a3 := (public.patrimonio_cadastrar(ua, dados || '{"nome":"Mesa A","numero_serie":"SN-TESTE-5"}') ->> 'id')::uuid;
  bem_a1 := (select id from public.patrimonio_bens where unidade_id = ua and tombamento = t1);

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.patrimonio_abrir_inventario(ub);
    falhas := falhas || 'p13: gerente da A abriu inventário da B'::text;
  exception when others then ok := ok + 1;
  end;
  inv := public.patrimonio_abrir_inventario(ua);
  if public.patrimonio_abrir_inventario(ua) = inv then ok := ok + 1; else falhas := falhas || 'um inventário aberto por empresa'::text; end if;

  -- Prova 7: ler o mesmo bem duas vezes conta uma.
  r := public.patrimonio_ler(inv, t1);
  r2 := public.patrimonio_ler(inv, t1);
  select count(*) into n from public.patrimonio_leituras where inventario_id = inv and not fora_da_empresa;
  if r ->> 'status' = 'encontrado' and r2 ->> 'status' = 'ja_lido' and n = 1 then ok := ok + 1;
  else falhas := falhas || format('p7: %s / %s / %s leituras', r ->> 'status', r2 ->> 'status', n); end if;

  -- Prova 8: bem de outra empresa avisa, não conta e não muda de empresa.
  r := public.patrimonio_ler(inv, t2);
  select count(*) into n from public.patrimonio_leituras where inventario_id = inv and not fora_da_empresa;
  if r ->> 'status' = 'outra_empresa' and r -> 'bem' ->> 'empresa' = 'Teste Pat B' and n = 1 then ok := ok + 1;
  else falhas := falhas || format('p8: %s, %s leituras', r, n); end if;
  r := public.patrimonio_ler(inv, 999999999);
  if r ->> 'status' = 'nao_existe' then ok := ok + 1; else falhas := falhas || format('número inexistente: %s', r); end if;

  -- Defeito marcado no inventário (quem só tem Patrimônio pode).
  perform public.patrimonio_marcar_defeito(inv, bem_a1, true);

  -- Prova 10: "sem etiqueta" só aceita bem da empresa ainda não lido, e marca para reimprimir.
  begin
    perform public.patrimonio_sem_etiqueta(inv, bem_b);
    falhas := falhas || 'p10: aceitou bem de outra empresa'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    perform public.patrimonio_sem_etiqueta(inv, bem_a1);
    falhas := falhas || 'p10: aceitou bem já lido'::text;
  exception when others then ok := ok + 1;
  end;
  perform public.patrimonio_sem_etiqueta(inv, bem_a2);
  select count(*) into n from public.patrimonio_bens where id = bem_a2 and reimprimir_etiqueta;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p10: não marcou para reimprimir'::text; end if;

  -- Prova 9: fechar lista o não encontrado sem dar baixa.
  r := public.patrimonio_fechar_inventario(inv);
  if (r -> 'nao_encontrados') = jsonb_build_array(bem_a3) and (r ->> 'encontrados')::int = 2
     and (r ->> 'com_defeito')::int = 1 and (r ->> 'fora_da_empresa')::int = 1 then ok := ok + 1;
  else falhas := falhas || format('p9: relatório %s', r); end if;
  select count(*) into n from public.patrimonio_bens where id = bem_a3 and situacao = 'em_uso';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p9: não encontrado mudou de situação'::text; end if;
  select count(*) into n from public.patrimonio_bens where id = bem_a1 and situacao = 'com_defeito';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'defeito do inventário não marcou o bem'::text; end if;
  begin
    perform public.patrimonio_ler(inv, t1);
    falhas := falhas || 'leu em inventário fechado'::text;
  exception when others then ok := ok + 1;
  end;

  reset role;
  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
