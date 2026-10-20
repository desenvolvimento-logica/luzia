-- Novidades publicadas no painel do sino (luzia_news). Conteúdo para o colaborador: linguagem simples,
-- sem termos técnicos. Idempotente: cada novidade é identificada pela versão e não é inserida duas vezes.
-- Aplicar no SQL Editor junto com o deploy que trouxe as mudanças (docs/operacao.md, "Novidades").

begin;

insert into public.luzia_news (title, body, version, published_at)
select v.title, v.body, v.version, v.published_at::timestamptz
  from (values
    (
      'Boas-vindas ao novo Luz.IA',
      E'O Luz.IA foi reconstruído para ficar mais organizado e fácil de usar.\n\n• Menu lateral com tudo à mão — dá para recolhê-lo quando você precisar de mais espaço.\n• Catálogo com as aplicações do seu departamento e busca por nome.\n• Tema claro ou escuro: escolha no ícone ao lado do sininho.\n\nVocê continua entrando com a sua conta Microsoft do escritório, como sempre. Algumas aplicações ainda podem pedir login enquanto finalizamos a integração com o novo Luz.IA.',
      '2.0',
      '2026-10-20 14:00:00-03'
    ),
    (
      'Relatórios mais completos para gestores',
      E'Quem acompanha a equipe agora vê, para qualquer período:\n\n• total de aberturas, de colaboradores e de aplicações acessadas;\n• um gráfico dia a dia e as aplicações mais usadas;\n• o histórico completo, com ordenação por qualquer coluna.\n\nOs números consideram todo o período escolhido.',
      '2.1',
      '2026-10-20 14:10:00-03'
    ),
    (
      'Aplicações em tela cheia',
      E'Ao abrir uma aplicação, ela agora ocupa toda a área da tela, sem margens.\n\nPrecisa de ainda mais espaço? Use o botão Tela cheia, na barra da aplicação. Para sair, aperte Esc.',
      '2.2',
      '2026-10-20 15:00:00-03'
    ),
    (
      'As novidades agora ficam no sininho',
      E'Sempre que algo mudar no Luz.IA, o resumo aparece aqui, no sininho no alto da tela. A bolinha amarela indica que há novidade publicada nos últimos dias.',
      '2.3',
      '2026-10-20 15:30:00-03'
    )
  ) as v (title, body, version, published_at)
 where not exists (select 1 from public.luzia_news n where n.version = v.version);

commit;

select version, title, published_at from public.luzia_news order by published_at;
