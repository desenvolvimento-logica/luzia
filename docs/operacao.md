# Operação do Luz.IA (hub novo)

Procedimentos para quando o hub novo estiver em uso. Valores de segredos ficam no painel da Vercel/Supabase e no cofre; nunca neste repositório.

## Admissão

1. Conta Microsoft 365 corporativa ativa no tenant do escritório.
2. O colaborador entra no hub. Se o e-mail já existir em `users` sem identidade, o cadastro é vinculado; senão é criado como Usuário, sem administração, em “Não atribuído” (sem nenhuma aplicação).
3. Administração › Colaboradores: definir departamento, cargo e, se for o caso, administração.
4. Conferir que o e-mail é idêntico (inclusive maiúsculas/minúsculas) nas aplicações que usam conciliação por e-mail (Atividades).

## Mudança de departamento ou cargo

Administração › Colaboradores › Editar. O catálogo e o escopo de relatórios mudam na próxima requisição. Relatórios seguem o departamento **atual** (não há histórico de lotação).

## Desligamento / retirada de acesso

1. Hub: Administração › Colaboradores › “Acesso ao hub: Desativado”. Efeito imediato no hub (leituras, aberturas e entrega de sessão), mesmo com token ainda válido.
2. Microsoft Entra: desativar a conta (impede novos logins).
3. Cada aplicação: sessões já persistidas nas apps e credenciais locais (ex.: login por senha do contcheck) **não** são encerradas pelo hub. Desativar também lá.
4. Só declarar o desligamento completo depois dos três passos. Não excluir o cadastro (histórico de acessos e auditoria).

## Troca de identidade ou e-mail vinculado

Não é editável pela tela. Executar, autenticado como administrador, a RPC `admin_change_identity(p_user_id, p_new_auth_user_id, p_new_email, p_reason)` com motivo de pelo menos 10 caracteres; a alteração fica na auditoria com o motivo. Confirmar antes que a nova identidade pertence à mesma pessoa.

## Cadastro de aplicação

1. A origem da URL precisa estar em `LUZIA_APP_ALLOWED_ORIGINS` (configuração do servidor + CSP `frame-src`, aplicada no build). Ampliar a lista é uma mudança de configuração revisada, não um efeito do formulário.
2. Administração › Aplicações › Nova: nome, descrição, URL publicada (HTTPS), ícone (emoji ou imagem PNG/JPEG/WebP até 2 MB, recorte 3:4), audiência.
3. A app precisa do `hub-session-listener` com `HUB_ORIGIN` do hub e aceitar ser exibida em iframe pelo hub (`frame-ancestors`). O iframe usa `sandbox` sem `allow-top-navigation`.
4. Abrir pelo hub: se aparecer o aviso de que a app não sinalizou prontidão, verificar listener e cabeçalhos da app; o hub registra `luzia_iframe_incompativel` nos logs do servidor.
5. Preferir desativar a excluir (apps com histórico não podem ser excluídas).

## Rotação de segredos

- `SUPABASE_SERVICE_ROLE_KEY` do hub: usada só pelos adaptadores de atividades. A mesma chave existe nas apps (R-04): rotacionar exige atualizar todas as variáveis customizadas das apps e do hub na mesma janela.
- Chave pública (anon/publishable): pública por desenho, mas rotacionar junto quando o projeto trocar de chaves.
- Depois de rotacionar: rebuild do hub (variáveis públicas são inlinadas) e `npm run check:bundle` num build com valor-canário.

## Investigação de falhas

| Sintoma | Verificar |
|---|---|
| “Esta conta não está autorizada” | Conta fora do tenant, provedor diferente de `azure`, cadastro vinculado a outra identidade. |
| “O hub está sem configuração de autenticação” | `private.settings.azure_tenant_id` ausente, variáveis públicas ausentes. |
| App não abre / “configuração inválida” | Origem fora de `LUZIA_APP_ALLOWED_ORIGINS`, URL não HTTPS, app inativa. Logs: `luzia_app_url_recusada`. |
| App abre mas pede senha | Listener da app, `HUB_ORIGIN`, client Supabase errado na app (armadilhas da spec operacional, seção 12). O hub só sabe que **enviou** a sessão. |
| Gestor não vê alguém | Matriz: líder vê só Usuários do próprio departamento; coordenador, Usuários e Líderes; departamento atual. |
| Atividades “ainda não suportada” | Mapeamento da fonte não configurado (X-06). |
| Atividades “indisponível” | Service role ausente no servidor ou a tabela da app não respondeu. |

## Retenção

Não há expurgo automático de acessos, atividades ou auditoria. Definir política com o escritório antes de implementar (X-09).
