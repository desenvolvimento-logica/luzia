-- Reversão do CORTE: volta à fase coexistence (hub antigo volta a ser a fonte).
--
-- Seguro para os dados: nada é apagado. public.users/public.dpto já receberam, pelo espelho, as mudanças de
-- departamentos e colaboradores feitas no hub novo, então o hub antigo os vê atualizados.
-- O que NÃO volta para o hub antigo (vive só em luzia_): aplicações/audiências alteradas no hub novo, estado de
-- acesso (desativações), novidades e eventos de acesso. Reaplicar essas mudanças manualmente no hub antigo se
-- necessário. Uma reimportação posterior sobrescreve as aplicações luzia_ vindas do legado com os dados do legado.

begin;

do $$
begin
  if private.luzia_phase() <> 'primary' then
    raise exception 'luzia: fase atual não é primary; nada a reverter';
  end if;
end
$$;

update public.luzia_settings set value = 'coexistence' where key = 'phase';

commit;
