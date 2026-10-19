# Luz.IA — Especificação de reconstrução

Versão: 0.1 — 19/10/2026  
Destino: Claude Code no VSCode  
Estado: proposta de implementação para revisão do responsável pelo produto.

## 1. Objetivo e fontes

Reconstruir a Luz.IA, portal central de aplicações do Escritório Lógica Contabilidade. O colaborador entra com a conta Microsoft corporativa e acessa as aplicações autorizadas para seu departamento. Gestores acompanham acessos e atividades de sua equipe; administradores gerenciam o catálogo e os acessos.

O usuário confirmou a intenção de reconstruir a aplicação para melhorá-la. Os detalhes de solução deste documento são propostas, salvo quando identificados como requisitos herdados.

Fonte do sistema anterior: `LuzIA-Spec-Operacional.md`, na raiz. Esse documento descreve um sistema existente em outro local e deve ser preservado. Suas marcações de confiança continuam válidas: alegações sobre código, banco e produção não foram verificadas nesta pasta. Na inspeção inicial, esta pasta continha apenas a spec operacional; não havia código da aplicação nem manifesto de dependências.

Não interpretar nomes de arquivos, versões, contagens, configurações ou pendências do sistema anterior como estado verificado da reconstrução. Registrar descobertas e divergências antes de depender delas.

## 2. Escopo e princípios

### Primeira versão

- Login Microsoft corporativo e provisionamento seguro do colaborador.
- Página inicial com catálogo de aplicações autorizadas.
- Abertura de aplicações e compatibilidade com o contrato de sessão existente.
- Gestão de departamentos, colaboradores, aplicações e novidades.
- Relatórios de acessos e atividades com autorização hierárquica.
- Interface em português, responsiva e acessível, com temas claro e escuro.
- Paginação, filtros e métricas calculadas sobre todo o período consultado.
- Auditoria administrativa, documentação de operação e plano de transição.

### Fora da primeira versão

- Reconstruir as aplicações integradas ou migrar seus históricos.
- Modificar regras internas e perfis de cada aplicação.
- Multiempresa, cobrança, chatbot e recursos de IA sem demanda definida. O nome Luz.IA não implica essas funcionalidades.
- Implantar um novo protocolo de SSO em todas as aplicações durante a reconstrução.

### Princípios obrigatórios

1. Autorizar operações no servidor e no banco; esconder botões não constitui controle de acesso.
2. Preservar os dados e a operação atual durante a reconstrução.
3. Não executar scripts destrutivos do sistema anterior em banco existente.
4. Não colocar tokens, senhas, dados reais de clientes ou chaves administrativas em código, documentos, exemplos, logs ou testes.
5. Usar dados sintéticos no desenvolvimento e nos testes.
6. Não alterar as aplicações integradas sem necessidade demonstrada e escopo explícito.

## 3. Experiência do colaborador

### Login

- Tela com marca Luz.IA, identificação do escritório e botão “Entrar com Microsoft”.
- Usar o provedor Microsoft/Azure pelo Supabase Auth, preservando a identidade compartilhada com as aplicações.
- Validar tenant e política de contas corporativas na integração de identidade; não confiar apenas no domínio textual do e-mail.
- Tratar cancelamento, indisponibilidade e conta não autorizada com mensagens claras em português.
- Aceitar redirecionamento pós-login apenas para caminhos internos permitidos.
- Não oferecer cadastro público ou login por senha no hub.

### Primeiro acesso

- Vincular a identidade Microsoft ao cadastro corporativo existente, quando houver correspondência segura.
- Quando não houver cadastro, provisionar como `usuario`, sem administração e com departamento “Não atribuído”, apenas após validar a identidade corporativa.
- O vínculo definitivo usa o identificador da identidade autenticada; e-mail auxilia a conciliação legada e não permite reassociar uma conta já vinculada a outra identidade.
- Colaborador pendente de departamento recebe orientação de contato com a administração.
- Proposta de melhoria: “Não atribuído” não recebe aplicações automaticamente. Essa regra difere do legado e deve constar da validação de transição.

### Página inicial

- Mostrar nome do colaborador, departamento e aplicações disponíveis.
- Cards com nome, descrição curta, ícone e ação de abertura; busca por nome e descrição.
- Estados de carregamento, lista vazia, falha e tentativa novamente.
- Acesso visível às novidades e ao menu do usuário.
- Gestores também acessam o catálogo e têm uma área separada de relatórios; não substituir o catálogo por um dashboard obrigatório.
- Preservar a identidade visual de cinza/chumbo e amarelo, com contraste adequado. Usar Luz.IA como grafia da marca.

### Aplicação aberta

- Exibir título da aplicação, retorno ao catálogo, estado de carregamento e mensagem útil de falha.
- Validar acesso antes de carregar o iframe ou entregar sessão.
- Não oferecer abertura externa com promessa de SSO: o contrato atual depende do contexto do hub.
- Se uma aplicação impedir iframe por política do navegador ou cabeçalhos, registrar a incompatibilidade e orientar correção na integração.

## 4. Perfis e autorização

Cargo e permissão administrativa são independentes. Cargos herdados: `usuario`, `lider`, `coordenador`, `gerente`, `diretor`.

| Perfil | Escopo gerencial herdado |
|---|---|
| Usuário | Sem relatórios gerenciais |
| Líder | Usuários do próprio departamento |
| Coordenador | Usuários e líderes do próprio departamento |
| Gerente e diretor | Todos os colaboradores |
| Administrador | Todos os colaboradores e administração |

O próprio registro pode ser consultado para perfil e sessão, independentemente do escopo gerencial. Não ampliar implicitamente o escopo de relatórios para pares ou superiores. Validar a matriz com testes de servidor e RLS.

### Acesso a aplicações

- Aplicação precisa estar ativa e o colaborador habilitado.
- Proposta: explicitar a audiência como “Todos os departamentos” ou “Departamentos selecionados”.
- Em “Departamentos selecionados”, exigir ao menos um departamento. Uma lista vazia não significa acesso global.
- Na migração, aplicações sem vínculos departamentais no legado recebem explicitamente a audiência global, preservando a interpretação anterior.
- Proposta: administradores visualizam aplicações inativas na administração, mas a abertura normal permanece bloqueada; não enviar sessão a uma aplicação inativa.
- A autorização da aplicação integrada deve também ser aplicada aos seus próprios dados. A visibilidade do catálogo não substitui o RLS de cada aplicação.

### Desativação

- Proposta: incluir estado de acesso do colaborador no hub, preservando histórico.
- Colaborador desativado não pode consultar dados protegidos, abrir aplicações nem receber sessão pelo hub, mesmo com token ainda válido.
- Revalidar o estado nas operações protegidas e nas políticas aplicáveis, sem depender apenas de um dado armazenado na interface.
- Desativar no hub não revoga automaticamente sessões das aplicações ou credenciais locais legadas. Documentar processo conjunto com Microsoft e aplicações; não declarar desligamento completo sem essa verificação.

## 5. Administração

Somente `is_admin` pode executar operações administrativas. Aplicar autorização em cada ação e no banco.

### Departamentos

- Listar, buscar, criar e editar nome.
- Proteger o departamento especial de provisionamento.
- Não excluir departamento com colaboradores ou vínculos sem tratamento explícito das dependências.

### Colaboradores

- Listar com busca e filtros por departamento, cargo e estado.
- Editar departamento, cargo e administração; ativar ou desativar acesso ao hub.
- Identidade e e-mail vinculados não são campos de livre alteração. Mudança de identidade exige procedimento específico com auditoria.
- Proposta: impedir a remoção da última conta administrativa ativa, inclusive sob requisições concorrentes.
- Não excluir fisicamente colaboradores com histórico.

### Aplicações

- Criar e editar nome, descrição, URL, ícone, estado e audiência.
- URL deve usar HTTPS e origem aprovada de domínio controlado. Exceção local somente em configuração de desenvolvimento.
- A lista de origens aprovadas deve vir de configuração confiável; não ser automaticamente ampliada ao salvar qualquer URL no formulário.
- Rejeitar esquemas como `javascript:`, `data:` e URLs com credenciais embutidas.
- Preservar suporte a emoji e imagem. Para imagens de capa, usar proporção 3:4 e mostrar prévia do recorte.
- Validar tamanho, tipo e conteúdo de uploads; proposta inicial: PNG, JPEG ou WebP, até 2 MB. Não aceitar SVG sem política de sanitização.
- Preferir desativação a exclusão quando houver histórico.

### Novidades

- Criar e editar título, conteúdo, versão opcional e data de publicação.
- Conteúdo não pode executar HTML ou scripts arbitrários.
- Ordenar por data e paginar histórico. Não criar controle de leitura individual sem requisito posterior.

### Auditoria administrativa

- Registrar ator, ação, entidade, identificador, data e alterações relevantes de cadastro, permissões, estado e URL.
- Registrar a auditoria junto da mutação de forma atômica.
- Não registrar tokens ou segredos; minimizar dados pessoais duplicados.
- Auditoria não pode ser alterada ou apagada pelo cliente comum.

## 6. Acessos, métricas e atividades

### Acessos

- Definir “acesso” como abertura autorizada de uma aplicação pelo hub; isso não comprova que o colaborador executou uma atividade nela.
- Registrar após autorização e início da abertura. Não registrar navegação negada como acesso bem-sucedido.
- Evitar duplicação por remontagem técnica, reenvio ou repetição de requisição usando identificador da abertura e gravação idempotente.
- Uma nova abertura intencional gera um novo evento. Falhas de iframe podem ocorrer após o evento; a interface e os relatórios não devem chamar esse evento de login bem-sucedido na aplicação.
- Não permitir que o cliente registre acesso em nome de outro colaborador.

### Relatórios

- Filtros por período, aplicação, colaborador e departamento, limitados pelo escopo do solicitante.
- Proposta inicial: últimos 30 dias; paginação de 25 itens, com máximo de 100 por página.
- Métricas: total de aberturas, colaboradores distintos com acesso, aplicações mais abertas e evolução diária.
- Aplicar os mesmos filtros e autorização à listagem e aos agregados.
- Calcular agregados no banco sobre todo o período; não derivá-los da página ou dos últimos 500 registros.
- Guardar timestamps em UTC e exibir/filtar dias no fuso `America/Sao_Paulo`, convertendo corretamente os limites de período.
- Documentar que a visibilidade segue o departamento atual do colaborador, como no legado. Análise por lotação histórica exige modelagem posterior.

### Atividades das aplicações

- Preservar inicialmente Fisco Check e Mensagens/Boas-vindas por adaptadores separados.
- Definir formato normalizado: origem, identificador, colaborador, departamento, tipo, descrição resumida e data.
- Cada adaptador valida autenticação, permissão e escopo antes de consultar ou retornar dados.
- Quando necessária, service role fica exclusivamente no servidor. Restringir consultas ao escopo autorizado e evitar cargas irrestritas seguidas de filtragem em memória.
- Conciliação por e-mail é compatibilidade legada; não transformar em identidade definitiva sem avaliar migração.
- Não expor diagnóstico de e-mails fora do escopo em parâmetro público de debug.
- Paginar resultados e distinguir “sem atividades”, “integração indisponível” e “integração ainda não suportada”.
- PERDCOMP, contcheck e Tax Planner ficam para etapa posterior, condicionada à verificação dos schemas e regras reais.

## 7. Compatibilidade de autenticação com as aplicações

Contrato herdado a preservar durante a transição:

```ts
// Aplicação → hub
{ type: "LUZIA_READY" }

// Hub → aplicação
{ type: "LUZIA_SESSION", access_token, refresh_token }
```

- Enviar somente ao `contentWindow` do iframe autorizado, com `targetOrigin` explícito derivado da URL validada.
- Ao receber READY, validar tanto `event.origin` quanto `event.source === iframe.contentWindow` e o formato da mensagem.
- Nunca usar `*` como origem de entrega da sessão.
- Revalidar sessão e autorização antes de cada entrega; não reenviar tokens obsoletos capturados no primeiro render.
- Suportar envio no carregamento e em READY com tratamento idempotente, evitando ciclos de mensagens.
- Nunca persistir o payload em logs, analytics ou auditoria.
- O contrato não contém confirmação de recebimento. Não declarar “sessão aplicada” com base apenas no envio.
- Não inventar mensagens de logout, renovação ou confirmação como se já fossem suportadas. Documentar evolução versionada caso necessária.
- Encerrar a sessão no hub remove o iframe e impede novas entregas. Validar separadamente o comportamento das sessões já persistidas nas aplicações.

O compartilhamento de refresh token amplia a confiança concedida às aplicações. Mantê-lo como compatibilidade legada exige domínio controlado e autorização rigorosa. Um protocolo futuro fica fora da primeira versão.

## 8. Arquitetura proposta

- Hub em Next.js App Router, React e TypeScript estrito; Supabase Auth/Postgres/Storage e hospedagem Vercel.
- Tailwind para estilos e biblioteca de ícones consistente. Reutilizar componentes para formulários, tabelas, diálogos e estados.
- Selecionar versões estáveis e compatíveis no início, verificando a documentação oficial. Não copiar automaticamente versões citadas na spec operacional.
- Separar consultas e serviços de domínio da interface, e clientes Supabase de navegador, sessão de servidor e administração.
- Priorizar consultas autorizadas no servidor. Usar componentes de cliente apenas onde houver interação necessária.
- Não criar um provider que carregue todo o banco e recarregue tudo após cada alteração.
- Aplicar cache apenas com isolamento de usuário e permissões; invalidar dados após mutações relevantes.
- Centralizar matriz de autorização, mantendo a aplicação efetiva no servidor e RLS.
- Manter o projeto de reconstrução simples na raiz. Não criar workspace com todas as aplicações antes de haver necessidade de edição delas.

Estrutura indicativa, adaptável às convenções da versão escolhida:

```text
src/
  app/                 # rotas, layouts e endpoints
  components/          # elementos de interface reutilizáveis
  features/            # catálogo, administração, relatórios, novidades
  lib/auth/            # identidade e autorização
  lib/supabase/        # clientes separados por contexto
  lib/activities/      # adaptadores e escopo de atividades
supabase/migrations/   # alterações incrementais versionadas
tests/                 # testes relevantes de domínio e integração
docs/                  # decisões, operação e transição
```

## 9. Dados e ambientes

- Desenvolver inicialmente em Supabase local ou projeto isolado, com dados sintéticos.
- Preservar como alvo de compatibilidade a identidade compartilhada e os IDs necessários às integrações existentes.
- Antes de definir migrations de produção, inspecionar schema, funções, triggers, grants, políticas e dependências reais.
- Preferir evolução incremental das tabelas do hub; mudanças de nome exigem mapa de compatibilidade e estratégia de transição.
- Novas tabelas devem ter RLS, grants explícitos, índices e restrições coerentes. Funções privilegiadas precisam de `search_path` fixo e permissões de execução restritas.
- Mudanças de política e novas colunas devem considerar que o hub antigo e as aplicações podem continuar operando no mesmo banco.
- Propostas de extensões: estado do colaborador, audiência explícita da aplicação, identificador idempotente de abertura e auditoria administrativa. Definir nomes e backfill somente após inspeção do schema.
- Não executar `schema.sql` legado sobre banco existente: a fonte informa que ele contém `drop table ... cascade`.

Variáveis iniciais, sem valores:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Se a versão escolhida usar outro tipo de chave pública, documentar o ajuste. A chave administrativa nunca recebe prefixo público. Documentar também a origem do hub e as origens aprovadas das aplicações, usando nomes definidos na implementação.

Versionar `.env.example` apenas com campos vazios ou placeholders. Ignorar arquivos locais de segredos, caches, builds, exports, dumps e dados sensíveis. Manter lockfile e migrations no controle de versão.

## 10. Qualidade e critérios de aceite

| ID | Evidência necessária |
|---|---|
| AC-01 | Login corporativo válido funciona; conta externa, cancelamento e callback inválido são tratados sem conceder acesso |
| AC-02 | Conta nova corporativa recebe perfil mínimo; não se torna administradora nem herda departamento indevido |
| AC-03 | Cada departamento recebe somente seu catálogo autorizado; URL direta e chamadas de servidor também negam acesso indevido |
| AC-04 | Aplicação inativa e colaborador desativado não recebem sessão |
| AC-05 | Matriz hierárquica é respeitada nas listagens, agregados, endpoints e políticas do banco |
| AC-06 | Somente administrador modifica cadastros e permissões; usuário comum não consegue promover a si mesmo |
| AC-07 | Mensagens com origem ou janela incorreta são ignoradas; nenhuma entrega usa origem curinga |
| AC-08 | Contrato existente abre aplicação de referência sem novo formulário de senha, validado em ambiente autorizado |
| AC-09 | Repetir a gravação de uma abertura não duplica evento; nova abertura intencional gera novo evento |
| AC-10 | Com mais de 500 acessos sintéticos, totais incluem todo o período e coincidem com a consulta de referência |
| AC-11 | Filtros, paginação e limites respeitam escopo e fuso, incluindo bordas de dias |
| AC-12 | Adaptadores não retornam atividades fora do escopo; indisponibilidade aparece separada de ausência de dados |
| AC-13 | Alterações administrativas geram auditoria atômica; remoção da última conta administrativa ativa é bloqueada |
| AC-14 | Interface funciona em celular e desktop, com teclado, foco visível, rótulos e contraste nos dois temas |
| AC-15 | Build, lint, checagem de tipos e testes relevantes passam; segredos administrativos não aparecem no bundle |
| AC-16 | Migrations são ensaiadas em cópia isolada e têm plano de reversão compatível com os dados |

Cobrir com testes automatizados as regras de autorização, transições de estado, idempotência, protocolo de mensagens e consultas agregadas. Testar RLS com identidades representativas, sem service role, além de testar serviços. Usar teste de navegador para fluxos críticos; login Microsoft real pode exigir validação manual em staging. Não declarar integrações externas como verificadas apenas com mocks.

## 11. Execução pelo Claude Code

### Etapa 0 — Preparação e decisões

1. Ler esta spec, a operacional e instruções locais aplicáveis.
2. Inventariar a pasta e registrar quais fontes estão disponíveis, sem procurar ou imprimir segredos.
3. Inicializar estrutura e controle de versão local, revisando exclusões antes de adicionar arquivos. Não publicar repositório ou fazer deploy implicitamente.
4. Verificar versões e APIs na documentação oficial antes de implementar.
5. Criar registro de decisões e lacunas. Se houver acesso ao código antigo, inspecioná-lo sem substituir esta reconstrução ou alterar produção.

### Etapa 1 — Fundação e identidade

Criar aplicação, interface básica, ambiente isolado, schema inicial de desenvolvimento, autenticação, provisionamento, autorização e testes da matriz. Entrega: login e perfil mínimo funcionando em ambiente de desenvolvimento, com limitações externas documentadas.

### Etapa 2 — Catálogo e administração

Implementar catálogo, CRUDs, audiência explícita, desativação, ícones, novidades e auditoria. Entrega: administrador configura aplicações e colaborador acessa somente o catálogo permitido.

### Etapa 3 — Aplicações integradas

Implementar iframe e contrato legado com aplicação simulada local; depois validar uma aplicação real em staging com origens configuradas. Entrega: abertura, autorização, sessão e registro idempotente de acesso.

### Etapa 4 — Relatórios

Implementar consultas paginadas, agregados e adaptadores Fisco Check/Tributário após confirmar schemas. Quando o acesso às fontes não estiver disponível, concluir a infraestrutura e registrar a validação externa pendente, sem inventar tabelas ou resultados.

### Etapa 5 — Transição

Inventariar banco real, preparar migrations e backfill, ensaiar em ambiente isolado, conferir autorização, contagens, identidades e integração. Preparar instruções de implantação e reversão. A execução em produção é uma ação separada da criação desta spec e da implementação local.

Para cada etapa, informar arquivos alterados, comportamento entregue, verificações realizadas e pendências concretas. Avançar nas tarefas independentes quando uma integração externa depender de configuração ou acesso ausente.

## 12. Transição e operação

- Evitar duas fontes concorrentes de identidade: manter compatibilidade com o projeto Supabase compartilhado, após confirmar o inventário real.
- Manter o hub atual disponível durante o desenvolvimento.
- Mudança de domínio exige atualizar callbacks OAuth e origens aceitas nas aplicações. Validar a troca antes do corte; não pressupor que previews Vercel já sejam confiáveis para SSO.
- Revisar e aprovar migrations, disponibilidade de backup e recuperação antes de alterações reais.
- Reversão deve considerar banco e origens aceitas pelas aplicações, além da versão do frontend. Não presumir que restaurar somente o deploy reverta uma migração.
- Documentar admissão, mudança de departamento/cargo, desligamento, cadastro de app, rotação de segredos e investigação de falhas.
- Retenção de acessos, atividades e auditoria precisa de definição do escritório; não implementar expurgo automático enquanto não houver regra aprovada.

## 13. Decisões pendentes do produto e da infraestrutura

Não bloqueiam a criação da base com dados sintéticos:

- Quais aspectos da interface e operação atuais mais precisam melhorar.
- Aprovação das propostas: bloqueio de “Não atribuído”, estado de acesso no hub, audiência explícita e proteção da última conta administrativa.
- Localização e acesso ao código atual, repositório remoto e responsáveis pela implantação.
- Tenant Microsoft, configuração real de cadastro e validação de contas externas no Supabase.
- Disponibilidade de ambiente isolado e origens de staging aceitas nas aplicações.
- Schemas, políticas e contratos reais de cada integração de atividades.
- Política de retenção e escopo de acesso aos registros de auditoria.

As propostas deste documento servem como padrão para a implementação local. Mudanças que alterem autorização efetiva ou dados do ambiente existente precisam ser destacadas na revisão de transição.

## 14. Prompt inicial para Claude Code

> Leia `LuzIA-Spec-Reconstrucao.md` e `LuzIA-Spec-Operacional.md`. Reconstrua a Luz.IA nesta pasta conforme as etapas e os critérios de aceite. Trate a operacional como referência do legado, preservando suas incertezas. Comece pelo inventário, decisões técnicas e fundação em ambiente isolado com dados sintéticos. Implemente e verifique o que for possível localmente, registrando dependências externas concretas. Preserve dados e integrações existentes; não execute scripts destrutivos, não exponha segredos e não faça alterações em produção. Diferencie comportamento implementado, teste com simulação e validação real de integração.
