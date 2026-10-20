-- DADOS SINTÉTICOS das tabelas LEGADAS, para desenvolvimento e testes. Nomes e e-mails fictícios (@exemplo.test).
-- Ponto de partida da importação para luzia_ (private.luzia_import_legacy()).
-- Aborta se houver mais de um departamento ou qualquer colaborador (indício de banco que não é vazio).

do $$
begin
  if (select count(*) from public.dpto) > 1 or exists (select 1 from public.users) then
    raise exception 'seed sintético: banco já contém dados do hub';
  end if;
end
$$;

insert into public.dpto (dpto_name, user_create) values
  ('Fiscal', 'seed-sintetico'),
  ('Tributário', 'seed-sintetico'),
  ('Contábil', 'seed-sintetico');

insert into public.users (user_name, user_email, user_dpto, user_role, is_admin, user_create)
select v.nome, v.email, d.dpto_id, v.cargo, v.admin, 'seed-sintetico'
  from (values
    ('Ana Administradora',  'ana.admin@exemplo.test',       'Contábil',      'usuario',     true),
    ('Davi Diretor',        'davi.diretor@exemplo.test',    'Contábil',      'diretor',     false),
    ('Gina Gerente',        'gina.gerente@exemplo.test',    'Fiscal',        'gerente',     false),
    ('Caio Coordenador',    'caio.coord@exemplo.test',      'Fiscal',        'coordenador', false),
    ('Cora Coordenadora',   'cora.coord@exemplo.test',      'Fiscal',        'coordenador', false),
    ('Lia Líder',           'lia.lider@exemplo.test',       'Fiscal',        'lider',       false),
    ('Leo Líder',           'leo.lider@exemplo.test',       'Fiscal',        'lider',       false),
    ('Ugo Usuário',         'ugo.usuario@exemplo.test',     'Fiscal',        'usuario',     false),
    ('Úrsula Usuária',      'Ursula.Usuaria@Exemplo.test',  'Fiscal',        'usuario',     false),
    ('Dora Desativada',     'dora.desativada@exemplo.test', 'Fiscal',        'usuario',     false),
    ('Téo Coordenador',     'teo.coord@exemplo.test',       'Tributário',    'coordenador', false),
    ('Tina Líder',          'tina.lider@exemplo.test',      'Tributário',    'lider',       false),
    ('Tom Usuário',         'tom.usuario@exemplo.test',     'Tributário',    'usuario',     false),
    ('Paulo Pendente',      'paulo.pendente@exemplo.test',  'Não atribuído', 'usuario',     false)
  ) as v(nome, email, dpto, cargo, admin)
  join public.dpto d on d.dpto_name = v.dpto;

insert into public.applications (app_name, app_description, app_url, app_icon, app_status, user_created) values
  ('Fisco Check',      'Comparação de obrigações fiscais', 'https://fiscocheck.exemplo.test/', '🧾', true,  'seed-sintetico'),
  ('Mensagens e-CAC',  'Caixa postal tributária',          'https://tributario.exemplo.test/', '✉️', true,  'seed-sintetico'),
  ('Portal Geral',     'Aplicação aberta a todos',         'https://geral.exemplo.test/',      '🌐', true,  'seed-sintetico'),
  ('Aplicação Antiga', 'Desativada',                       'https://antiga.exemplo.test/',     '📦', false, 'seed-sintetico');

-- Sem vínculos = "todos" no legado (Portal Geral, Aplicação Antiga).
insert into public.applications_dpto (app_id, dpto_id)
select a.app_id, d.dpto_id
  from (values ('Fisco Check', 'Fiscal'), ('Mensagens e-CAC', 'Tributário')) as v(app, dpto)
  join public.applications a on a.app_name = v.app
  join public.dpto d on d.dpto_name = v.dpto;

-- Não são migrados (decisão de 20/10/2026): ficam só no legado.
insert into public.patch_notes (note_title, note_body, note_version, dt_publish, user_create) values
  ('Nota legada', 'Permanece só no hub antigo.', '1.0.0', now() - interval '30 days', 'seed-sintetico');
