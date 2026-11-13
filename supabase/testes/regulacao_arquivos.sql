-- Prova de quem mexe nos arquivos da Regulação (migração 0022).
-- Roda como ensaio que se desfaz: termina em `raise exception 'RESULTADO ok=<n> falhas=<lista>'`.
-- Antes desta prova, rode o conteúdo de drizzle/migrations/0022_regulacao_arquivos.sql na mesma
-- transação (scripts/rodar-prova.mjs não faz isso: use o ensaio montado a partir dos dois arquivos).
do $$
declare
  ua uuid := gen_random_uuid();   -- unidade A
  ub uuid := gen_random_uuid();   -- unidade B
  gerente uuid := gen_random_uuid(); -- Regulação só na A
  outro uuid := gen_random_uuid();   -- sem Regulação (só Vendas) na A
  ok int := 0;
  falhas text[] := '{}';
  n int;
begin
  insert into public.unidades (id, nome, ordem) values (ua, 'Teste Reg A', 910), (ub, 'Teste Reg B', 911);
  -- O primeiro usuário do banco vira admin: este vem antes para os de teste serem comuns.
  insert into auth.users (id, email, aud, role) values
    (gen_random_uuid(), 'admin-reg@teste.invalid', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values
    (gerente, 'gerente-reg@teste.invalid', 'authenticated', 'authenticated'),
    (outro, 'outro-reg@teste.invalid', 'authenticated', 'authenticated');
  insert into public.gestao_acessos (user_id, unidade_id, modulos) values
    (gerente, ua, array['documentos']),
    (outro, ua, array['vendas']);
  -- Um arquivo da B, posto lá por quem administra (postgres, sem RLS).
  insert into storage.objects (bucket_id, name) values ('regulacao-documentos', ub::text || '/da-b.pdf');

  -- Gerente da A.
  perform set_config('request.jwt.claims', json_build_object('sub', gerente, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into storage.objects (bucket_id, name) values ('regulacao-documentos', ua::text || '/a1.pdf');
    ok := ok + 1;
  exception when others then falhas := falhas || ('gerente não anexou na A: ' || sqlerrm);
  end;
  select count(*) into n from storage.objects where bucket_id = 'regulacao-documentos' and name = ua::text || '/a1.pdf';
  if n = 1 then ok := ok + 1; else falhas := falhas || format('gerente leu %s do arquivo da A, esperava 1', n); end if;
  select count(*) into n from storage.objects where bucket_id = 'regulacao-documentos' and name like ub::text || '/%';
  if n = 0 then ok := ok + 1; else falhas := falhas || format('gerente da A leu %s arquivos da B', n); end if;
  begin
    insert into storage.objects (bucket_id, name) values ('regulacao-documentos', ub::text || '/invasao.pdf');
    falhas := falhas || 'gerente da A anexou na B';
  exception when others then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('regulacao-documentos', 'sem-unidade.pdf');
    falhas := falhas || 'anexou sem pasta de unidade';
  exception when others then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('regulacao-documentos', 'nao-e-uuid/x.pdf');
    falhas := falhas || 'anexou em pasta que não é unidade';
  exception when others then ok := ok + 1;
  end;
  delete from storage.objects where bucket_id = 'regulacao-documentos' and name = ua::text || '/a1.pdf';
  select count(*) into n from storage.objects where bucket_id = 'regulacao-documentos' and name = ua::text || '/a1.pdf';
  if n = 0 then ok := ok + 1; else falhas := falhas || 'gerente não apagou o arquivo da A'; end if;
  delete from storage.objects where bucket_id = 'regulacao-documentos' and name like ub::text || '/%';
  reset role;
  select count(*) into n from storage.objects where bucket_id = 'regulacao-documentos' and name = ub::text || '/da-b.pdf';
  if n = 1 then ok := ok + 1; else falhas := falhas || 'gerente da A apagou o arquivo da B'; end if;

  -- Quem só tem Vendas na A não mexe nos arquivos da Regulação.
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name) values ('regulacao-documentos', ua::text || '/sem-modulo.pdf');
    falhas := falhas || 'quem não tem Regulação anexou';
  exception when others then ok := ok + 1;
  end;
  reset role;

  -- Visitante sem login.
  set local role anon;
  begin
    perform 1 from storage.objects where bucket_id = 'regulacao-documentos';
    get diagnostics n = row_count;
    if n = 0 then ok := ok + 1; else falhas := falhas || format('visitante leu %s arquivos', n); end if;
  exception when others then ok := ok + 1;
  end;
  reset role;

  raise exception 'RESULTADO ok=% falhas=%', ok, array_to_string(falhas, ' | ');
end $$;
