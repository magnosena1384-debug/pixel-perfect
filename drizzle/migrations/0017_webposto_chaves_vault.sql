-- Chaves da API do webPosto, uma por posto, guardadas no Vault do Supabase com nomes
-- "webposto_chave_<n>". As chaves não entram nesta migração: são gravadas no Vault à parte.
-- Só administradores leem, e só por esta função (o servidor a chama ao importar).
create or replace function public.webposto_chaves()
returns table (nome text, chave text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente administradores podem usar a integração do webPosto.';
  end if;
  return query
    select s.name::text, s.decrypted_secret::text
    from vault.decrypted_secrets s
    where s.name like 'webposto_chave_%'
    order by s.name;
end;
$$;

revoke execute on function public.webposto_chaves() from public, anon;
grant execute on function public.webposto_chaves() to authenticated, service_role;
