# Plano de transição — tabelas `luzia_` no Supabase compartilhado

**Estado em 20/10/2026:** passos 1 a 4 executados no projeto compartilhado (fase `coexistence`). O corte (passo 5) não foi feito. Registro em [Execuções](#execuções). O projeto é produção (hub antigo, apps Lovable, LG, HelpDesk GC) e não há staging; cada passo marcado **[aprovação]** exige autorização explícita do dono do produto antes de rodar.

Ordem dos arquivos, todos aplicados manualmente no SQL Editor (nunca `supabase db push`):

| Passo | Arquivo | Escreve em | Reversível por |
|---|---|---|---|
| 1 | `supabase/inventory/inventario-somente-leitura.sql` | nada | — |
| 2 | `supabase/migrations/20261020100000_luzia_foundation.sql` | só objetos `luzia_` | `supabase/rollback/20261020100000_luzia_foundation.down.sql` |
| 3 | `insert into public.luzia_settings ... azure_tenant_id` + `select private.luzia_import_legacy();` | só `luzia_` | reimportar / passo 2 reverso |
| 4 | `supabase/verification/20261020100000_luzia_foundation.check.sql` | nada | — |
| 5 | `supabase/cutover/20261020110000_luzia_switch_to_primary.sql` | `luzia_settings`; a partir daí o espelho escreve em `public.users`/`public.dpto` | `supabase/rollback/20261020110000_luzia_switch_to_primary.down.sql` |

## 1. Inventário (somente leitura)

Rodar o inventário (uma consulta; o resultado é uma única célula JSON) e conferir antes de qualquer passo:

- `objetos_luzia_existentes`: vazio (sem colisão de nomes);
- `schema_private`: existe e `authenticated_usage` é `true` (a migração não altera o schema);
- `colunas_hub` e `restricoes_hub`: colunas e restrições de `public.users` e `public.dpto` (a migração exige `user_create` nas duas — X-13; tipos `bigint` de `user_id`/`dpto_id`);
- `fks_de_outros_sistemas`: FKs de outros sistemas para as tabelas do hub (esperado: `gestao_cadastros_*`, `lic_profiles`); confirma por que o espelho nunca apaga linhas;
- `identidades`: chaves de `identity_data` do provedor `azure` → onde está o `tid` (a RPC aceita `tid` ou `custom_claims.tid`); `quantidade_tids_distintos` deve ser 1;
- `contagens`: `users_email_repetido_ignorando_maiusculas` deve ser 0 (senão a importação aborta); `users_por_cargo` só com os cinco cargos; `dpto_nao_atribuido` = 1;
- `origens_app_url`: valor de `LUZIA_APP_ALLOWED_ORIGINS`;
- `gatilhos`: os de `auth.users` e das tabelas do hub (o hub novo não os altera).

Registrar divergências em `docs/decisoes.md` e ajustar a migração antes do passo 2.

## 2. Fundação — fase coexistence **[aprovação]**

Efeito: cria tabelas, tipos, funções e políticas `luzia_`. **Nenhuma** escrita em tabelas legadas ou de outros sistemas (provado em `tests/db/import-and-mirror.test.ts` comparando impressão digital de dados, políticas, gatilhos e grants do legado).

1. Confirmar backup/PITR (X-08).
2. Aplicar a migração (é uma transação única; um erro nas verificações prévias aborta tudo — rodar `rollback` no editor se ele ficar em transação abortada).
3. Configurar o tenant: `insert into public.luzia_settings (key, value) values ('azure_tenant_id', '<pegar no Entra>');` — o valor não vai para o repositório.
4. Importar: `select private.luzia_import_legacy();` (retorna JSON com contagens antes/depois/legado). Pode ser repetido quantas vezes for preciso: é idempotente e só lê o legado.
5. Verificação: todos os arrays de problemas vazios e `colaboradores_ausentes_no_luzia = 0`.

Durante a coexistência:

- O hub antigo continua sendo a fonte e operando sem nenhuma mudança.
- O hub novo pode ser publicado em um domínio controlado para validação (incluir `https://<dominio>/auth/callback` nas Redirect URLs do Supabase; **não** mudar a Site URL compartilhada). Login, catálogo, abertura de apps e relatórios funcionam; a administração é somente leitura.
- Quem entra no hub novo e ainda não foi importado é adotado se o gatilho legado já criou o cadastro; senão recebe "cadastro ainda não sincronizado".
- Reimportar sempre que o hub antigo mudar cadastros (ou logo antes do corte).

Reversão da fundação (só nesta fase): executar `supabase/rollback/20261020100000_luzia_foundation.down.sql` precedido de `set local luzia.confirm_drop = 'remover-objetos-luzia'` na mesma transação. Remove apenas objetos `luzia_` (inclusive eventos e novidades criados no hub novo).

## 3. Validações antes do corte

- Login Microsoft real: access token traz `amr` oauth e provedor `azure` (X-14); tenant confere (X-03).
- Uma aplicação de referência aceita a origem do hub novo e abre sem pedir senha (AC-08, X-05).
- RLS via PostgREST com identidades representativas (usuário, líder, coordenador, gerente, admin, inativo, “Não atribuído”).
- Revisão das mudanças de comportamento (`docs/decisoes.md`) com o dono do produto (X-10).

## 4. Corte — fase primary **[aprovação]**

1. Congelar cadastros no hub antigo (departamentos, usuários, aplicações).
2. Aplicar `supabase/cutover/20261020110000_luzia_switch_to_primary.sql`: reimportação final, exige tenant configurado e admin ativo vinculado, muda a fase para `primary`.
3. A partir daqui: administração acontece no hub novo; departamentos e colaboradores são espelhados para `public.dpto`/`public.users` com os mesmos IDs (HelpDesk GC e lic_ continuam funcionando); aplicações, audiências, estado de acesso e novidades vivem só em `luzia_`.
4. Tirar o hub antigo do ar (ou deixá-lo só leitura). Mudanças feitas nele depois do corte **não** voltam para `luzia_`.
5. Cadastros que o gatilho legado `on_auth_user_created` criar depois do corte são adotados no primeiro login no hub ou pelo botão “Trazer novos cadastros do legado” (Administração › Colaboradores).

Mudança de domínio (se houver): seguir RB-06 da spec operacional — Redirect URLs do Supabase, `HUB_ORIGIN` de **cada** app, domínio na Vercel. Em set/2026 essa troca quebrou login e todos os SSOs ao mesmo tempo: validar app por app.

## 5. Reversão do corte

`supabase/rollback/20261020110000_luzia_switch_to_primary.down.sql` volta a fase para `coexistence`. Nada é apagado; o legado já recebeu pelo espelho as mudanças de departamentos e colaboradores. **Não voltam** ao hub antigo: aplicações/audiências alteradas no hub novo, desativações, novidades e eventos. Depois, republicar o hub antigo e devolver as origens das apps.

## Execuções

| Data (UTC) | Passo | Resultado |
|---|---|---|
| 20/10/2026 14:10 | 1 — inventário | Sem objetos `luzia_`; pré-condições atendidas; achados F-01 a F-03 (`docs/decisoes.md`). Complemento: `user_id`/`dpto_id` são `GENERATED ALWAYS`. |
| 20/10/2026 14:46 | impressão digital (antes) | 17 dpto, 133 users, 679 access_log, 8 applications, 25 applications_dpto, 3 patch_notes, 76 auth.users. |
| 20/10/2026 | 2 — fundação | Aplicada sem erro (transação única). |
| 20/10/2026 | 2 — tenant | Gravado a partir de `auth.identities` (1 tenant); valor não registrado no repositório. |
| 20/10/2026 | 3 — importação | 17 departamentos, 133 colaboradores, 8 aplicações, 25 vínculos; 0 registros só no `luzia_`. |
| 20/10/2026 | 4 — verificação | Fase `coexistence`; sem RLS desligado, sem escrita direta, sem leitura `anon`, sem função definer sem `search_path`, sem objeto `luzia_` em tabelas compartilhadas; 0 divergências; 1 admin ativo. |
| 20/10/2026 14:52 | impressão digital (depois) | **Idêntica** à anterior em dados e estrutura (políticas, gatilhos, grants, funções, ACL do schema `private`). |

Executado pelo responsável no SQL Editor; resultados (sem dados pessoais) conferidos na sessão de desenvolvimento.

## Fora deste plano

- Remover o gatilho legado de auto-provisionamento (R-02/R-03): afeta GC e lic_, que dependem das linhas criadas por ele. Decisão separada.
- Aposentar `public.users`/`public.dpto`: só quando GC e lic_ deixarem de referenciá-las.
- Migrar `access_log` e `patch_notes` (decidido não migrar em 20/10/2026).
