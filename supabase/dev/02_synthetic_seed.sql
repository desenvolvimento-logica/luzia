-- DADOS SINTÉTICOS para desenvolvimento e testes. Nomes e e-mails fictícios (@exemplo.test).
-- Só preenche tabelas do hub; vínculos com auth.users são feitos pelos testes ou no primeiro login.
-- Aborta se houver mais de um departamento (indício de banco que não é vazio).

do $$
begin
  if (select count(*) from public.dpto) > 1 or exists (select 1 from public.users) then
    raise exception 'seed sintético: banco já contém dados do hub';
  end if;
end
$$;

begin;

insert into public.dpto (dpto_name, user_create) values
  ('Fiscal', 'seed-sintetico'),
  ('Tributário', 'seed-sintetico'),
  ('Contábil', 'seed-sintetico');

insert into public.users (user_name, user_email, user_dpto, user_role, is_admin, access_status, user_create)
select v.nome, v.email, d.dpto_id, v.cargo, v.admin, v.estado, 'seed-sintetico'
  from (values
    ('Ana Administradora',  'ana.admin@exemplo.test',      'Contábil',      'usuario',     true,  'ativo'),
    ('Davi Diretor',        'davi.diretor@exemplo.test',   'Contábil',      'diretor',     false, 'ativo'),
    ('Gina Gerente',        'gina.gerente@exemplo.test',   'Fiscal',        'gerente',     false, 'ativo'),
    ('Caio Coordenador',    'caio.coord@exemplo.test',     'Fiscal',        'coordenador', false, 'ativo'),
    ('Cora Coordenadora',   'cora.coord@exemplo.test',     'Fiscal',        'coordenador', false, 'ativo'),
    ('Lia Líder',           'lia.lider@exemplo.test',      'Fiscal',        'lider',       false, 'ativo'),
    ('Leo Líder',           'leo.lider@exemplo.test',      'Fiscal',        'lider',       false, 'ativo'),
    ('Ugo Usuário',         'ugo.usuario@exemplo.test',    'Fiscal',        'usuario',     false, 'ativo'),
    ('Úrsula Usuária',      'ursula.usuaria@exemplo.test', 'Fiscal',        'usuario',     false, 'ativo'),
    ('Dora Desativada',     'dora.desativada@exemplo.test','Fiscal',        'usuario',     false, 'desativado'),
    ('Téo Coordenador',     'teo.coord@exemplo.test',      'Tributário',    'coordenador', false, 'ativo'),
    ('Tina Líder',          'tina.lider@exemplo.test',     'Tributário',    'lider',       false, 'ativo'),
    ('Tom Usuário',         'tom.usuario@exemplo.test',    'Tributário',    'usuario',     false, 'ativo'),
    ('Paulo Pendente',      'paulo.pendente@exemplo.test', 'Não atribuído', 'usuario',     false, 'ativo')
  ) as v(nome, email, dpto, cargo, admin, estado)
  join public.dpto d on d.dpto_name = v.dpto;

insert into public.applications (app_name, app_description, app_url, app_icon, app_status, audience, user_created) values
  ('Fisco Check',      'Comparação de obrigações fiscais', 'https://fiscocheck.exemplo.test/', '🧾', true,  'selecionados', 'seed-sintetico'),
  ('Mensagens e-CAC',  'Caixa postal tributária',          'https://tributario.exemplo.test/', '✉️', true,  'selecionados', 'seed-sintetico'),
  ('Portal Geral',     'Aplicação aberta a todos',         'https://geral.exemplo.test/',      '🌐', true,  'todos',        'seed-sintetico'),
  ('Aplicação Antiga', 'Desativada',                       'https://antiga.exemplo.test/',     '📦', false, 'todos',        'seed-sintetico');

insert into public.applications_dpto (app_id, dpto_id)
select a.app_id, d.dpto_id
  from (values ('Fisco Check', 'Fiscal'), ('Mensagens e-CAC', 'Tributário')) as v(app, dpto)
  join public.applications a on a.app_name = v.app
  join public.dpto d on d.dpto_name = v.dpto;

insert into public.patch_notes (note_title, note_body, note_version, dt_publish, user_create) values
  ('Novo catálogo', 'Busca por nome e descrição.', '2.0.0', now() - interval '2 days', 'seed-sintetico'),
  ('Relatórios', 'Totais calculados sobre todo o período.', '2.1.0', now() - interval '1 day', 'seed-sintetico'),
  ('Agendada', 'Ainda não publicada.', '2.2.0', now() + interval '7 days', 'seed-sintetico');

commit;
