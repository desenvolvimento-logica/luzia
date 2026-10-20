<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras do projeto Luz.IA

- Fontes: `LuzIA-Spec-Reconstrucao.md` (alvo) e `LuzIA-Spec-Operacional.md` (legado — preservar; marcações `[A CONFIRMAR]` não viram fato).
- Autorização acontece no servidor e no banco (RLS). Esconder botão não é controle de acesso. A matriz está em `private.luzia_visible_collaborator_ids()` e espelhada em `src/lib/auth/matrix.ts`; mudar uma exige mudar a outra e os testes.
- Supabase compartilhado e de produção (`olyvjnqmrzkziirzbmhi`, com hub antigo, apps, LG e HelpDesk GC). Só criar/alterar objetos `luzia_` em `public` e `private.luzia_*`. Nunca alterar `auth.*`, `public.users`, `public.dpto`, objetos de outros prefixos nem privilégios do schema `private`. Os dados de `public.users`/`public.dpto` só são escritos pelo espelho da fase primary, sem exclusões.
- Aplicar SQL só manualmente no SQL Editor, com aprovação; nunca `supabase db push`. Nunca executar `schema.sql` legado nem scripts destrutivos em banco existente. `supabase/dev/*` é só para banco vazio de teste.
- Migrations novas: incrementais, idempotentes, com RLS, grants explícitos, `security definer` só com `search_path = ''`, e reversão em `supabase/rollback/`.
- Nada de tokens, senhas, chaves ou dados reais de clientes em código, testes, docs ou logs. Dados de teste: `@exemplo.test`.
- Clientes só leem tabelas `luzia_`; escrita só por RPC `luzia_admin_*`.
- `SUPABASE_SECRET_KEY` só em `src/lib/supabase/admin.ts` e só depois de resolver o escopo (`luzia_report_scope`).
- Contrato `LUZIA_READY`/`LUZIA_SESSION` não muda sem versão nova documentada; nunca `*` como origem.
- Diferenciar sempre: implementado / testado com simulação / validado em integração real (`docs/criterios-de-aceite.md`).
- Antes de concluir: `npm run verify`.
