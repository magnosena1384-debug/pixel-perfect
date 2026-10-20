-- Prova de quem vê o quê no RH (combinado, provas 11, 12 e 13).
-- Roda pela ligação com o Supabase. Tudo acontece dentro deste bloco e é desfeito no fim pelo
-- `raise exception`, cuja mensagem traz o resultado: RESULTADO ok=<n> falhas=<lista>.
do $$
declare
  ua uuid := gen_random_uuid();   -- unidade A
  ub uuid := gen_random_uuid();   -- unidade B
  gerente uuid := gen_random_uuid(); -- rh e rh-importar só na A
  leitor uuid := gen_random_uuid();  -- só rh na A
  ok int := 0;
  falhas text[] := '{}';
  n int;
  dois_dias jsonb := '[
    {"colaborador":"TESTE UM","nome":"Teste Um","data":"2026-10-01","jornada":"08:00 12:00","batidas":["08:00","12:00"],"diurna_min":240,"noturna_min":0,"extras_min":0,"extras100_min":0,"hn_min":0,"descontos_min":0,"observacao":"","folga":false,"trabalhou":true},
    {"colaborador":"TESTE UM","nome":"Teste Um","data":"2026-10-02","jornada":"08:00 12:00","batidas":[],"diurna_min":0,"noturna_min":0,"extras_min":0,"extras100_min":0,"hn_min":0,"descontos_min":240,"observacao":"","folga":false,"trabalhou":false}
  ]';
  uma_falta jsonb := '[{"colaborador":"TESTE UM","nome":"Teste Um","cpf":"000.000.000-00","cargo":"FRENTISTA","setor":"PISTA","vinculo":"CLT","tipo":"FALTA","data":"2026-10-02"}]';
  um_saldo jsonb := '[{"colaborador":"TESTE UM","nome":"Teste Um","setor":"PISTA","admissao":"2024-01-02","credito":60,"debito":132,"saldo":-72}]';
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste RH A', 900), (ub, 'Teste RH B', 901);
  insert into auth.users (id, email, aud, role) values
    (gerente, 'gerente-rh@teste.invalid', 'authenticated', 'authenticated'),
    (leitor, 'leitor-rh@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gerente, ua, array['rh', 'rh-importar']),
    (leitor, ua, array['rh']);
  insert into public.rh_ponto_dias (unidade_id, colaborador, nome, data) values (ub, 'OUTRO POSTO', 'Outro Posto', '2026-10-01');

  -- Gerente da A, como usuário logado.
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Prova 11: importar o mesmo período duas vezes não duplica.
  perform public.rh_gravar_ponto(ua, 'freq.xls', '2026-10-01', '2026-10-02', dois_dias);
  perform public.rh_gravar_ponto(ua, 'freq.xls', '2026-10-01', '2026-10-02', dois_dias);
  select count(*) into n from public.rh_ponto_dias where unidade_id = ua;
  if n = 2 then ok := ok + 1; else falhas := falhas || format('p11: %s dias na A, esperava 2', n); end if;

  -- Prova 12: não lê nada da B.
  select count(*) into n from public.rh_ponto_dias where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p12: leu %s dias da B', n); end if;

  -- Prova 13: quem só tem "rh" não grava, nem pela função nem direto na tabela.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', leitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.rh_gravar_ponto(ua, 'freq.xls', '2026-10-01', '2026-10-02', dois_dias);
    falhas := falhas || 'p13: leitor gravou pela função'::text;
  exception when others then ok := ok + 1;
  end;
  begin
    insert into public.rh_ponto_dias (unidade_id, colaborador, nome, data) values (ua, 'X', 'X', '2026-10-03');
    falhas := falhas || 'p13: leitor gravou direto na tabela'::text;
  exception when others then ok := ok + 1;
  end;
  select count(*) into n from public.rh_ponto_dias where unidade_id = ua;
  if n = 2 then ok := ok + 1; else falhas := falhas || format('p12: leitor da A vê %s dias, esperava 2', n); end if;
  begin
    perform public.rh_gravar_irregularidades(ua, 'irr.xls', '2026-10-01', '2026-10-19', uma_falta);
    falhas := falhas || 'p13: leitor gravou irregularidades'::text;
  exception when others then ok := ok + 1;
  end;

  -- Irregularidades (0009): o gerente grava duas vezes sem duplicar e não vê as da B.
  reset role;
  insert into public.rh_irregularidades (unidade_id, colaborador, nome, tipo, data) values (ub, 'OUTRO POSTO', 'Outro Posto', 'FALTA', '2026-10-01');
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.rh_gravar_irregularidades(ua, 'irr.xls', '2026-10-01', '2026-10-19', uma_falta);
  perform public.rh_gravar_irregularidades(ua, 'irr.xls', '2026-10-01', '2026-10-19', uma_falta);
  select count(*) into n from public.rh_irregularidades where unidade_id = ua;
  if n = 1 then ok := ok + 1; else falhas := falhas || format('p11: %s irregularidades na A, esperava 1', n); end if;
  select count(*) into n from public.rh_irregularidades where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p12: leu %s irregularidades da B', n); end if;

  -- Banco de horas (0010): troca a foto inteira e não vê a da B.
  reset role;
  insert into public.rh_banco_horas (unidade_id, colaborador, nome, referencia) values (ub, 'OUTRO POSTO', 'Outro Posto', '2026-12-31');
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.rh_gravar_banco_horas(ua, 'banco.xls', '2026-12-31', um_saldo);
  perform public.rh_gravar_banco_horas(ua, 'banco.xls', '2026-12-31', um_saldo);
  select count(*) into n from public.rh_banco_horas where unidade_id = ua;
  if n = 1 then ok := ok + 1; else falhas := falhas || format('p11: %s saldos na A, esperava 1', n); end if;
  select count(*) into n from public.rh_banco_horas where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('p12: leu %s saldos da B', n); end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', leitor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.rh_gravar_banco_horas(ua, 'banco.xls', '2026-12-31', um_saldo);
    falhas := falhas || 'p13: leitor gravou banco de horas'::text;
  exception when others then ok := ok + 1;
  end;

  reset role;
  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
