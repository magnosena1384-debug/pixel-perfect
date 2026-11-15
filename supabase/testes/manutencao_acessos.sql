-- Prova de quem vê e grava drenagens e aferições (migração 0024).
-- Roda pela ligação com o Supabase (scripts/rodar-prova.mjs) depois da migração aplicada. Tudo
-- acontece neste bloco e é desfeito no fim pelo `raise exception`: RESULTADO ok=<n> falhas=<lista>.
do $$
declare
  ua uuid := gen_random_uuid();   -- unidade A
  ub uuid := gen_random_uuid();   -- unidade B
  gerente uuid := gen_random_uuid(); -- Manutenção só na A
  outro uuid := gen_random_uuid();   -- só Vendas na A
  ok int := 0;
  falhas text[] := '{}';
  n int;
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste Man A', 920), (ub, 'Teste Man B', 921);
  -- O primeiro usuário do banco vira admin: este vem antes para os de teste serem comuns.
  insert into auth.users (id, email, aud, role) values
    (gen_random_uuid(), 'admin-man@teste.invalid', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values
    (gerente, 'gerente-man@teste.invalid', 'authenticated', 'authenticated'),
    (outro, 'outro-man@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gerente, ua, array['manutencao']),
    (outro, ua, array['vendas']);
  insert into public.manutencao_drenagens (unidade_id, data, tanque, produto) values (ub, '2026-11-01', '1', 'Diesel S-10');
  insert into public.manutencao_afericoes (unidade_id, data, bomba, bico, produto) values (ub, '2026-11-01', '1', '1', 'Etanol');

  -- Gerente da A.
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.manutencao_drenagens (unidade_id, data, tanque, produto, volume_amostra_litros, tem_agua)
    values (ua, '2026-11-10', '1', 'Diesel S-10', 2, false);
    ok := ok + 1;
  exception when others then falhas := falhas || ('gerente não lançou drenagem na A: ' || sqlerrm);
  end;
  begin
    insert into public.manutencao_afericoes (unidade_id, data, bomba, bico, produto, responsavel)
    values (ua, '2026-11-10', '2', '7', 'Gasolina Comum', 'Teste');
    ok := ok + 1;
  exception when others then falhas := falhas || ('gerente não lançou aferição na A: ' || sqlerrm);
  end;
  select count(*) into n from public.manutencao_drenagens where unidade_id = ua;
  if n = 1 then ok := ok + 1; else falhas := falhas || format('gerente leu %s drenagens da A, esperava 1', n); end if;
  select count(*) into n from public.manutencao_drenagens where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('gerente da A leu %s drenagens da B', n); end if;
  select count(*) into n from public.manutencao_afericoes where unidade_id = ub;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('gerente da A leu %s aferições da B', n); end if;
  begin
    insert into public.manutencao_drenagens (unidade_id, data, tanque, produto) values (ub, '2026-11-10', '1', 'Diesel S-10');
    falhas := falhas || 'gerente da A lançou drenagem na B';
  exception when others then ok := ok + 1;
  end;
  begin
    insert into public.manutencao_afericoes (unidade_id, data, bomba, bico, produto) values (ub, '2026-11-10', '1', '1', 'Etanol');
    falhas := falhas || 'gerente da A lançou aferição na B';
  exception when others then ok := ok + 1;
  end;
  delete from public.manutencao_drenagens where unidade_id = ub;
  reset role;
  select count(*) into n from public.manutencao_drenagens where unidade_id = ub;
  if n = 1 then ok := ok + 1; else falhas := falhas || 'gerente da A apagou drenagem da B'; end if;

  -- Quem só tem Vendas na A não vê nem grava.
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.manutencao_drenagens where unidade_id = ua;
  if n = 0 then ok := ok + 1; else falhas := falhas || format('quem não tem Manutenção leu %s drenagens', n); end if;
  begin
    insert into public.manutencao_afericoes (unidade_id, data, bomba, bico, produto) values (ua, '2026-11-10', '1', '1', 'Etanol');
    falhas := falhas || 'quem não tem Manutenção lançou aferição';
  exception when others then ok := ok + 1;
  end;
  reset role;

  -- Visitante sem login.
  set local role anon;
  begin
    perform 1 from public.manutencao_drenagens;
    falhas := falhas || 'visitante consultou drenagens';
  exception when others then ok := ok + 1;
  end;
  reset role;

  -- Importação não duplica: o mesmo id de origem na mesma unidade é recusado.
  insert into public.manutencao_drenagens (unidade_id, origem_id, data, tanque, produto) values (ua, 'ps-1', '2026-11-01', '1', 'Diesel S-10');
  begin
    insert into public.manutencao_drenagens (unidade_id, origem_id, data, tanque, produto) values (ua, 'ps-1', '2026-11-01', '1', 'Diesel S-10');
    falhas := falhas || 'aceitou o mesmo id de origem duas vezes';
  exception when unique_violation then ok := ok + 1;
  end;

  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
