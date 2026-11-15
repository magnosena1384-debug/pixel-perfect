-- Prova de quem mexe nas fotos de evidência (migração 0026).
-- Roda pela ligação com o Supabase (scripts/rodar-prova.mjs) depois da migração aplicada. Tudo
-- acontece neste bloco e é desfeito no fim pelo `raise exception`: RESULTADO ok=<n> falhas=<lista>.
do $$
declare
  ua uuid := gen_random_uuid();   -- unidade A
  ub uuid := gen_random_uuid();   -- unidade B
  gerente uuid := gen_random_uuid(); -- Rotinas e Manutenção só na A
  rotina uuid := gen_random_uuid();  -- só Rotinas na A
  outro uuid := gen_random_uuid();   -- só Vendas na A
  ok int := 0;
  falhas text[] := '{}';
  n int;
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste Evid A', 930), (ub, 'Teste Evid B', 931);
  -- O primeiro usuário do banco vira admin: este vem antes para os de teste serem comuns.
  insert into auth.users (id, email, aud, role) values
    (gen_random_uuid(), 'admin-evid@teste.invalid', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values
    (gerente, 'gerente-evid@teste.invalid', 'authenticated', 'authenticated'),
    (rotina, 'rotina-evid@teste.invalid', 'authenticated', 'authenticated'),
    (outro, 'outro-evid@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gerente, ua, array['rotinas', 'manutencao']),
    (rotina, ua, array['rotinas']),
    (outro, ua, array['vendas']);
  -- Uma foto da B, posta por quem administra (postgres, sem RLS).
  insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ub::text || '/rotinas/da-b.jpg');

  -- Gerente da A (tem os dois módulos).
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/rotinas/a1.jpg');
    ok := ok + 1;
  exception when others then falhas := falhas || ('gerente não anexou foto de rotina na A: ' || sqlerrm);
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/manutencao/a2.jpg');
    ok := ok + 1;
  exception when others then falhas := falhas || ('gerente não anexou foto de manutenção na A: ' || sqlerrm);
  end;
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias' and name like ua::text || '/%';
  if n = 2 then ok := ok + 1; else falhas := falhas || format('gerente leu %s fotos da A, esperava 2', n); end if;
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias' and name like ub::text || '/%';
  if n = 0 then ok := ok + 1; else falhas := falhas || format('gerente da A leu %s fotos da B', n); end if;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ub::text || '/rotinas/invasao.jpg');
    falhas := falhas || 'gerente da A anexou foto na B';
  exception when others then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/vendas/x.jpg');
    falhas := falhas || 'anexou foto num módulo que não tem evidência (vendas)';
  exception when others then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', 'sem-unidade.jpg');
    falhas := falhas || 'anexou sem pasta de unidade';
  exception when others then ok := ok + 1;
  end;
  delete from storage.objects where bucket_id = 'gestao-evidencias' and name = ua::text || '/rotinas/a1.jpg';
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias' and name = ua::text || '/rotinas/a1.jpg';
  if n = 0 then ok := ok + 1; else falhas := falhas || 'gerente não apagou a foto da A'; end if;
  delete from storage.objects where bucket_id = 'gestao-evidencias' and name like ub::text || '/%';
  reset role;
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias' and name = ub::text || '/rotinas/da-b.jpg';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'gerente da A apagou a foto da B'; end if;

  -- Quem só tem Rotinas na A: mexe nas fotos de rotinas, mas não nas de manutenção.
  perform set_config('request.jwt.claims', json_build_object('sub', rotina, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/rotinas/r1.jpg');
    ok := ok + 1;
  exception when others then falhas := falhas || ('quem tem Rotinas não anexou foto de rotina: ' || sqlerrm);
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/manutencao/r2.jpg');
    falhas := falhas || 'quem só tem Rotinas anexou foto de manutenção';
  exception when others then ok := ok + 1;
  end;
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias' and name like ua::text || '/manutencao/%';
  if n = 0 then ok := ok + 1; else falhas := falhas || format('quem só tem Rotinas leu %s fotos de manutenção', n); end if;
  reset role;

  -- Quem só tem Vendas na A não vê nem anexa nada.
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'gestao-evidencias';
  if n = 0 then ok := ok + 1; else falhas := falhas || format('quem não tem o módulo leu %s fotos', n); end if;
  begin
    insert into storage.objects (bucket_id, name) values ('gestao-evidencias', ua::text || '/rotinas/o1.jpg');
    falhas := falhas || 'quem não tem o módulo anexou foto';
  exception when others then ok := ok + 1;
  end;
  reset role;

  -- Visitante sem login.
  set local role anon;
  begin
    perform 1 from storage.objects where bucket_id = 'gestao-evidencias';
    get diagnostics n = row_count;
    if n = 0 then ok := ok + 1; else falhas := falhas || format('visitante leu %s fotos', n); end if;
  exception when others then ok := ok + 1;
  end;
  reset role;

  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
