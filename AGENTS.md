<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras do projeto Luz.IA

- Fontes: `LuzIA-Spec-Reconstrucao.md` (alvo) e `LuzIA-Spec-Operacional.md` (legado — preservar; marcações `[A CONFIRMAR]` não viram fato).
- Autorização acontece no servidor e no banco (RLS). Esconder botão não é controle de acesso. A matriz está em `private.visible_user_ids()` e espelhada em `src/lib/auth/matrix.ts`; mudar uma exige mudar a outra e os testes.
- Nunca executar `schema.sql` legado nem scripts destrutivos em banco existente. `supabase/dev/*` é só para banco vazio de teste.
- Migrations novas: incrementais, idempotentes, com RLS, grants explícitos, `security definer` só com `search_path = ''`, e reversão em `supabase/rollback/`.
- Nada de tokens, senhas, chaves ou dados reais de clientes em código, testes, docs ou logs. Dados de teste: `@exemplo.test`.
- `SUPABASE_SERVICE_ROLE_KEY` só em `src/lib/supabase/admin.ts` e só depois de resolver o escopo (`report_scope_users`).
- Contrato `LUZIA_READY`/`LUZIA_SESSION` não muda sem versão nova documentada; nunca `*` como origem.
- Diferenciar sempre: implementado / testado com simulação / validado em integração real (`docs/criterios-de-aceite.md`).
- Antes de concluir: `npm run verify`.
