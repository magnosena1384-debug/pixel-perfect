-- Patrimônio: baixa de bens (venda, descarte, furto/perda ou cadastro duplicado). O bem baixado
-- para de depreciar na data da baixa, sai do inventário e das etiquetas, e continua no histórico.
create or replace function public.patrimonio_baixar(_bem uuid, _motivo text, _data date, _observacao text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _b public.patrimonio_bens;
begin
  select * into _b from public.patrimonio_bens where id = _bem for update;
  if not found or not public.patrimonio_pode_gerenciar(_b.unidade_id) then
    raise exception 'Você não tem permissão para gerenciar o patrimônio desta empresa.';
  end if;
  if _b.situacao not in ('em_uso', 'com_defeito') then
    raise exception 'Bem em trânsito ou já baixado não pode receber baixa.';
  end if;
  if _motivo not in ('venda', 'descarte', 'furto_perda', 'cadastro_duplicado') then
    raise exception 'Motivo de baixa inválido.';
  end if;
  if _data is null or _data < _b.data_compra or _data > current_date then
    raise exception 'A data da baixa precisa estar entre a compra e hoje.';
  end if;

  update public.patrimonio_bens
  set situacao = 'baixado', baixa_data = _data, baixa_motivo = _motivo,
      baixa_obs = nullif(trim(_observacao), ''), reimprimir_etiqueta = false
  where id = _bem;
  insert into public.patrimonio_historico (bem_id, evento, detalhe)
  values (_bem, 'baixa', concat_ws(' · ', case _motivo
      when 'venda' then 'Venda' when 'descarte' then 'Descarte'
      when 'furto_perda' then 'Furto ou perda' else 'Cadastro duplicado' end,
    to_char(_data, 'DD/MM/YYYY'), nullif(trim(_observacao), '')));
end $$;

revoke execute on function public.patrimonio_baixar(uuid, text, date, text) from public, anon;
grant execute on function public.patrimonio_baixar(uuid, text, date, text) to authenticated, service_role;
