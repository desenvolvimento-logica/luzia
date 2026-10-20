// Traduz erros do Postgres/PostgREST para mensagens úteis, sem expor detalhes internos.

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
}

const BY_HINT: Record<string, string> = {
  luzia_last_admin: "Não é possível remover a última conta administrativa ativa.",
  luzia_protected_department: "O departamento de provisionamento (“Não atribuído”) é protegido.",
  luzia_department_in_use: "Este departamento tem colaboradores ativos. Mova-os antes de desativar.",
  luzia_no_delete: "Registros com histórico não são excluídos; desative-os.",
  luzia_audience_empty: "Selecione ao menos um departamento ou escolha “Todos os departamentos”.",
  luzia_inactive: "Seu acesso ao hub está desativado.",
  luzia_app_denied: "Você não tem acesso a esta aplicação.",
  luzia_not_admin: "Somente administradores ativos podem fazer esta alteração.",
  luzia_read_only_phase: "Durante a transição, cadastros são alterados no hub antigo. A administração aqui é somente leitura.",
};

export function dbErrorMessage(error: DbErrorLike | null | undefined, fallback = "Não foi possível concluir a operação."): string {
  if (!error) return fallback;
  if (error.hint && BY_HINT[error.hint]) return BY_HINT[error.hint]!;
  switch (error.code) {
    case "23505":
      return "Já existe um registro com este valor.";
    case "23503":
      return "Existem registros vinculados; a operação não foi feita.";
    case "23514":
      return error.message?.includes("url_safe") ? "URL de aplicação recusada pelo banco." : "Valor fora das regras permitidas.";
    case "42501":
      return "Operação não autorizada.";
    case "22023":
      return "Parâmetros inválidos.";
    default:
      return fallback;
  }
}
