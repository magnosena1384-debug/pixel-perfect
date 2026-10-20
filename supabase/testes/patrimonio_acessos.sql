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
  uc uuid := gen_random_uuid();
  gerente_b uuid := gen_random_uuid();
  gerente_c uuid := gen_random_uuid();
  tr uuid;
  tomb_t bigint;
  gestor_a uuid := gen_random_uuid(); -- gerenciar só na A
  bem_a4 uuid;
  inv_b uuid;
  dados jsonb := '{"nome":"Bomba 1","categoria":"Bombas e equipamentos de pista","setor":"Pista","numero_serie":"SN-TESTE-1","data_compra":"2026-01-15","valor_compra_centavos":1200000,"vida_util_anos":10}';
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste Pat A', 900), (ub, 'Teste Pat B', 901);
  insert into auth.users (id, email, aud, role) values
    (gestor, 'gestor-pat@teste.invalid', 'authenticated', 'authenticated'),
    (gerente_a, 'gerente-pat@teste.invalid', 'authenticated', 'authenticated'),
    (gestor_a, 'gestor-a-pat@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gestor_a, ua, array['patrimonio-gerenciar']),
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
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.patrimonio_cadastrar(ua, dados || '{"numero_serie":"SN-TESTE-2"}');
  if r -> 'repetido' ->> 'empresa' = 'Teste Pat B' and not (r -> 'repetido' ? 'nome') and not (r -> 'repetido' ? 'id')
  then ok := ok + 1; else falhas := falhas || format('p6/p13: aviso mostrou bem de outra empresa: %s', r); end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;

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
  perform public.patrimonio_editar(bem_b, dados || jsonb_build_object('setor', 'Loja', 'unidade_id', ua, 'nome', 'Cofre', 'numero_serie', 'SN-TESTE-2'));
  select count(*) into n from public.patrimonio_bens where id = bem_b and setor = 'Loja' and unidade_id = ub;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'edição: setor não mudou ou empresa mudou'::text; end if;
  select count(*) into n from public.patrimonio_historico where bem_id = bem_b;
  if n = 2 then ok := ok + 1; else falhas := falhas || format('histórico com %s eventos, esperava 2', n); end if;

  -- Inventário (0014): mais dois bens na A, um que vai sem etiqueta e um que não aparece.
  bem_a2 := (public.patrimonio_cadastrar(ua, dados || '{"nome":"Cofre A","numero_serie":"SN-TESTE-4"}') ->> 'id')::uuid;
  bem_a3 := (public.patrimonio_cadastrar(ua, dados || '{"nome":"Mesa A","numero_serie":"SN-TESTE-5"}') ->> 'id')::uuid;
  bem_a1 := (select id from public.patrimonio_bens where unidade_id = ua and tombamento = t1);
  r := public.patrimonio_editar(bem_a3, dados || '{"nome":"Mesa A","numero_serie":"SN-TESTE-4"}');
  select count(*) into n from public.patrimonio_bens where id = bem_a3 and numero_serie = 'SN-TESTE-5';
  if r ? 'repetido' and n = 1 then ok := ok + 1; else falhas := falhas || format('p6: edição gravou série repetida: %s', r); end if;
  bem_a4 := (public.patrimonio_cadastrar(ua, dados || '{"nome":"Cadeira A","numero_serie":"SN-TESTE-6"}') ->> 'id')::uuid;

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
  if r ->> 'status' = 'outra_empresa' and r -> 'bem' ->> 'empresa' = 'Teste Pat B' and n = 1
     and not (r -> 'bem' ? 'nome') and not (r -> 'bem' ? 'id')
     and not exists (select 1 from public.patrimonio_leituras where inventario_id = inv and aviso like '%Cofre%') then ok := ok + 1;
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
  perform public.patrimonio_ler(inv, (select tombamento from public.patrimonio_bens where id = bem_a4));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.patrimonio_baixar(bem_a4, 'descarte', current_date, '');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
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

  -- Transferências (0015): A → B, vista pela origem e pelo destino, nunca por C.
  reset role;
  insert into public.unidades (id, nome, ordem) values (uc, 'Teste Pat C', 902);
  insert into auth.users (id, email, aud, role) values
    (gerente_b, 'gerente-b-pat@teste.invalid', 'authenticated', 'authenticated'),
    (gerente_c, 'gerente-c-pat@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gerente_b, ub, array['patrimonio']), (gerente_c, uc, array['patrimonio']);
  tomb_t := (select tombamento from public.patrimonio_bens where id = bem_a3);

  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tr := public.patrimonio_transferir(bem_a3, ub, 'teste');
  -- Prova 11: em trânsito continua da origem.
  select count(*) into n from public.patrimonio_bens where id = bem_a3 and unidade_id = ua and situacao = 'em_transito';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p11: em trânsito não ficou na origem'::text; end if;
  begin
    perform public.patrimonio_transferir(bem_a3, uc, '');
    falhas := falhas || 'transferiu bem em trânsito de novo'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    perform public.patrimonio_editar(bem_a3, dados);
    falhas := falhas || 'editou bem em trânsito'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    perform public.patrimonio_transferir(bem_a2, ua, '');
    falhas := falhas || 'transferiu para a própria empresa'::text;
  exception when others then ok := ok + 1;
  end;

  -- Prova 14: só o destino recebe.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.patrimonio_receber(tr);
    falhas := falhas || 'p14: a origem recebeu'::text;
  exception when others then ok := ok + 1;
  end;
  select count(*) into n from public.patrimonio_bens where id = bem_a3;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p13: origem não vê o bem em trânsito'::text; end if;
  begin
    perform public.patrimonio_transferir(bem_a2, ub, '');
    falhas := falhas || 'p12: quem só vê enviou transferência'::text;
  exception when others then ok := ok + 1;
  end;

  -- Prova 13: terceira empresa não vê o bem nem a transferência.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.patrimonio_bens where id = bem_a3;
  select count(*) + n into n from public.patrimonio_transferencias where id = tr;
  if n = 0 then ok := ok + 1; else falhas := falhas || 'p13: terceira empresa viu a transferência'::text; end if;

  -- Destino vê o bem em trânsito, recebe; o bem passa a ser dele com o mesmo tombamento (prova 2).
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.patrimonio_bens where id = bem_a3 and situacao = 'em_transito';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p13: destino não vê o bem em trânsito'::text; end if;
  begin
    perform public.patrimonio_cancelar_transferencia(tr);
    falhas := falhas || 'o destino cancelou'::text;
  exception when others then ok := ok + 1;
  end;
  perform public.patrimonio_receber(tr);
  select count(*) into n from public.patrimonio_bens
  where id = bem_a3 and unidade_id = ub and situacao = 'em_uso' and tombamento = tomb_t;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p11/p2: recebido não virou do destino com o mesmo tombamento'::text; end if;
  select count(*) into n from public.patrimonio_historico where bem_id = bem_a3;
  if n >= 4 then ok := ok + 1; else falhas := falhas || format('destino vê só %s eventos do histórico', n); end if;

  -- Cancelada, volta para a origem com a situação de antes.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tr := public.patrimonio_transferir(bem_a1, ub, '');
  perform public.patrimonio_cancelar_transferencia(tr);
  select count(*) into n from public.patrimonio_bens where id = bem_a1 and unidade_id = ua and situacao = 'com_defeito';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'p11: cancelada não voltou para a origem'::text; end if;

  -- Baixa (0016): só quem gerencia; bem em trânsito não; baixado sai do inventário.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.patrimonio_baixar(bem_a2, 'descarte', current_date, '');
    falhas := falhas || 'p12: quem só vê deu baixa'::text;
  exception when others then ok := ok + 1;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tr := public.patrimonio_transferir(bem_a2, ub, '');
  begin
    perform public.patrimonio_baixar(bem_a2, 'descarte', current_date, '');
    falhas := falhas || 'baixou bem em trânsito'::text;
  exception when others then ok := ok + 1;
  end;
  perform public.patrimonio_cancelar_transferencia(tr);
  begin
    perform public.patrimonio_baixar(bem_a2, 'qualquer', current_date, '');
    falhas := falhas || 'aceitou motivo inválido'::text;
  exception when others then ok := ok + 1;
  end;
  perform public.patrimonio_baixar(bem_a2, 'descarte', '2026-03-15', 'quebrou');
  select count(*) into n from public.patrimonio_bens
  where id = bem_a2 and situacao = 'baixado' and baixa_data = '2026-03-15' and baixa_motivo = 'descarte';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'baixa não gravou'::text; end if;
  begin
    perform public.patrimonio_editar(bem_a2, dados);
    falhas := falhas || 'editou bem baixado'::text;
  exception when others then ok := ok + 1;
  end;
  inv := public.patrimonio_abrir_inventario(ua);
  r := public.patrimonio_ler(inv, (select tombamento from public.patrimonio_bens where id = bem_a2));
  if r ->> 'status' = 'baixado' then ok := ok + 1; else falhas := falhas || format('baixado no inventário: %s', r); end if;

  -- Prova 13: inventário, leituras e transferências de B não aparecem para o gerente da A.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  inv_b := public.patrimonio_abrir_inventario(ub);
  perform public.patrimonio_ler(inv_b, t2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gestor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tr := public.patrimonio_transferir(bem_b, uc, '');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.patrimonio_inventarios where id = inv_b;
  select count(*) + n into n from public.patrimonio_leituras where inventario_id = inv_b;
  select count(*) + n into n from public.patrimonio_transferencias where id = tr;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p13: gerente da A viu %s registros de B', n); end if;
  begin
    perform public.patrimonio_etiquetas_impressas(array[bem_a1]);
    falhas := falhas || 'p12: quem só vê registrou etiqueta'::text;
  exception when others then ok := ok + 1;
  end;

  -- Quem tem Patrimônio vê o nome de todas as empresas do grupo (para escolher o destino).
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gerente_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.patrimonio_empresas_do_grupo() e where e.id in (ua, ub, uc);
  if n = 3 then ok := ok + 1; else falhas := falhas || format('empresas do grupo: %s de 3', n); end if;

  reset role;
  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
