-- Importação automática do webPosto de hora em hora: o pg_cron chama a função
-- webposto-sincronizar (supabase/functions) com um segredo guardado no Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A função do servidor (service_role) também lê as chaves.
create or replace function public.webposto_chaves()
returns table (nome text, chave text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente administradores podem usar a integração do webPosto.';
  end if;
  return query
    select s.name::text, s.decrypted_secret::text
    from vault.decrypted_secrets s
    where s.name like 'webposto_chave_%'
    order by s.name;
end;
$$;

-- Segredo do agendador: gerado aqui, nunca escrito no repositório.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'webposto_cron_segredo') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'),
      'webposto_cron_segredo', 'Segredo do pg_cron para a importação automática do webPosto');
  end if;
end $$;

create or replace function public.webposto_cron_confere(_segredo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'webposto_cron_segredo' and decrypted_secret = _segredo and _segredo <> ''
  );
$$;
revoke execute on function public.webposto_cron_confere(text) from public, anon, authenticated;
grant execute on function public.webposto_cron_confere(text) to service_role;

select cron.schedule(
  'webposto-sincronizar',
  '5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ybftywiceifdvgnsmows.supabase.co/functions/v1/webposto-sincronizar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-segredo', (select decrypted_secret from vault.decrypted_secrets where name = 'webposto_cron_segredo')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
