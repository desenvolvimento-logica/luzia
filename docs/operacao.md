# Operação do Luz.IA (hub novo)

Procedimentos para quando o hub novo estiver em uso. Valores de segredos ficam no painel da Vercel/Supabase e no cofre; nunca neste repositório.

## Fases

- **Coexistência** (antes do corte): cadastros são mantidos no hub antigo e copiados para o hub novo por `select private.luzia_import_legacy();` no SQL Editor. A administração do hub novo é somente leitura.
- **Primary** (depois do corte): cadastros são mantidos no hub novo. Departamentos e colaboradores são replicados para `public.dpto`/`public.users`, que o HelpDesk GC e o lic_ continuam usando.

Os procedimentos abaixo descrevem a fase primary.

## Admissão

1. Conta Microsoft 365 corporativa ativa no tenant do escritório.
2. O colaborador entra no hub. O cadastro criado pelo gatilho legado do projeto é adotado com o mesmo id; se não houver, o hub cria um (replicado em `public.users`) como Usuário, sem administração, em “Não atribuído” (sem nenhuma aplicação). Cadastros novos do legado também podem ser trazidos em Administração › Colaboradores › “Trazer novos cadastros do legado”.
3. Administração › Colaboradores: definir departamento, cargo e, se for o caso, administração.
4. Conferir que o e-mail é idêntico (inclusive maiúsculas/minúsculas) nas aplicações que usam conciliação por e-mail (Atividades).

## Mudança de departamento ou cargo

Administração › Colaboradores › Editar. O catálogo e o escopo de relatórios mudam na próxima requisição. Relatórios seguem o departamento **atual** (não há histórico de lotação).

## Desligamento / retirada de acesso

1. Hub: Administração › Colaboradores › “Acesso ao hub: Desativado”. Efeito imediato no hub (leituras, aberturas e entrega de sessão), mesmo com token ainda válido. **Não** é replicado ao cadastro corporativo: HelpDesk GC e lic_ não ficam sabendo.
2. Microsoft Entra: desativar a conta (impede novos logins).
3. Cada aplicação: sessões já persistidas nas apps e credenciais locais (ex.: login por senha do contcheck) **não** são encerradas pelo hub. Desativar também lá.
4. Só declarar o desligamento completo depois dos três passos. Não excluir o cadastro (histórico de acessos e auditoria).

## Troca de identidade ou e-mail vinculado

Não é editável pela tela. Executar, autenticado como administrador, a RPC `luzia_admin_change_identity(p_id, p_new_auth_user_id, p_new_email, p_reason)` com motivo de pelo menos 10 caracteres; a alteração fica na auditoria com o motivo e é replicada em `public.users`. Confirmar antes que a nova identidade pertence à mesma pessoa.

## Cadastro de aplicação

1. A origem da URL precisa estar em `LUZIA_APP_ALLOWED_ORIGINS` (configuração do servidor + CSP `frame-src`, aplicada no build). Ampliar a lista é uma mudança de configuração revisada, não um efeito do formulário.
2. Administração › Aplicações › Nova: nome, descrição, URL publicada (HTTPS), ícone (emoji ou imagem PNG/JPEG/WebP até 2 MB, recorte 3:4), audiência.
3. A app precisa do `hub-session-listener` com `HUB_ORIGIN` do hub e aceitar ser exibida em iframe pelo hub (`frame-ancestors`). O iframe usa `sandbox` sem `allow-top-navigation`.
4. Abrir pelo hub: se aparecer o aviso de que a app não sinalizou prontidão, verificar listener e cabeçalhos da app; o hub registra `luzia_iframe_incompativel` nos logs do servidor.
5. Aplicações, departamentos e colaboradores não são excluídos: desative.

## Rotação de segredos

- `SUPABASE_SECRET_KEY` do hub: usada só pelos adaptadores de atividades. O projeto é compartilhado (R-04): rotacionar exige atualizar hub, LG, HelpDesk GC e as variáveis customizadas das apps Lovable na mesma janela.
- Chave pública (anon/publishable): pública por desenho, mas rotacionar junto quando o projeto trocar de chaves.
- Depois de rotacionar: rebuild do hub (variáveis públicas são inlinadas) e `npm run check:bundle` num build com valor-canário.

## Investigação de falhas

| Sintoma | Verificar |
|---|---|
| “Esta conta não está autorizada” | Conta fora do tenant, sessão que não veio do login Microsoft, cadastro vinculado a outra identidade. |
| “Seu cadastro ainda não chegou ao novo Luz.IA” | Coexistência: reimportar (`select private.luzia_import_legacy();`) depois de o cadastro existir no hub antigo. |
| Administração “somente leitura” | Fase coexistence; o corte ainda não foi feito. |
| “O hub está sem configuração de autenticação” | `public.luzia_settings` sem `azure_tenant_id`, variáveis públicas ausentes. |
| App não abre / “configuração inválida” | Origem fora de `LUZIA_APP_ALLOWED_ORIGINS`, URL não HTTPS, app inativa. Logs: `luzia_app_url_recusada`. |
| App abre mas pede senha | Listener da app, `HUB_ORIGIN`, client Supabase errado na app (armadilhas da spec operacional, seção 12). O hub só sabe que **enviou** a sessão. |
| Gestor não vê alguém | Matriz: líder vê só Usuários do próprio departamento; coordenador, Usuários e Líderes; departamento atual. |
| Atividades “ainda não suportada” | Mapeamento da fonte não configurado (X-06). |
| Atividades “indisponível” | Service role ausente no servidor ou a tabela da app não respondeu. |

## Retenção

Não há expurgo automático de acessos, atividades ou auditoria. Definir política com o escritório antes de implementar (X-09).
