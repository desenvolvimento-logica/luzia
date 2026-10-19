// Tipos escritos à mão a partir de supabase/dev/01_legacy_baseline.sql + supabase/migrations.
// Substituir por `supabase gen types typescript` quando houver acesso ao projeto isolado (X-01/X-02).

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type DbCargo = "usuario" | "lider" | "coordenador" | "gerente" | "diretor";

export type DptoRow = {
  dpto_id: number;
  dpto_name: string;
  dpto_kind: "normal" | "provisionamento";
  dt_create: string;
  user_create: string | null;
};

export type UserRow = {
  user_id: number;
  auth_user_id: string | null;
  user_name: string;
  user_email: string;
  user_dpto: number | null;
  user_role: DbCargo;
  is_admin: boolean;
  access_status: "ativo" | "desativado";
  status_changed_at: string | null;
  dt_create: string;
  user_create: string | null;
};

export type ApplicationRow = {
  app_id: number;
  app_name: string;
  app_description: string | null;
  app_url: string;
  app_icon: string | null;
  app_status: boolean;
  audience: "todos" | "selecionados";
  dt_created: string;
  user_created: string | null;
};

export type ApplicationDptoRow = {
  app_id: number;
  dpto_id: number;
};

export type AccessLogRow = {
  log_id: number;
  user_id: number;
  app_id: number;
  datetime: string;
  open_id: string | null;
};

export type PatchNoteRow = {
  note_id: number;
  note_title: string;
  note_body: string;
  note_version: string | null;
  dt_publish: string;
  user_create: string | null;
};

export type AdminAuditRow = {
  audit_id: number;
  created_at: string;
  actor_auth_id: string | null;
  actor_user_id: number | null;
  action: string;
  entity: string;
  entity_id: string;
  changes: Record<string, unknown>;
  reason: string | null;
};

export type ReportMetrics = {
  total_opens: number;
  distinct_users: number;
  top_apps: { app_id: number; app_name: string | null; total: number }[];
  daily: { day: string; total: number }[];
};

export type ReportPageRow = {
  log_id: number;
  opened_at: string;
  user_id: number;
  user_name: string;
  dpto_id: number | null;
  dpto_name: string | null;
  app_id: number;
  app_name: string | null;
  total_count: number;
};

type ReportFilters = {
  p_from: string;
  p_to: string;
  p_app_id?: number | null;
  p_user_id?: number | null;
  p_dpto_id?: number | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      dpto: Table<DptoRow, "dpto_name">;
      users: Table<UserRow, "user_name" | "user_email">;
      applications: Table<ApplicationRow, "app_name" | "app_url">;
      applications_dpto: Table<ApplicationDptoRow, "app_id" | "dpto_id">;
      access_log: Table<AccessLogRow, "user_id" | "app_id">;
      patch_notes: Table<PatchNoteRow, "note_title" | "note_body">;
      admin_audit: Table<AdminAuditRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      luzia_provision_me: {
        Args: Record<string, never>;
        Returns: { user_id: number; access_status: string; provisioned: boolean; linked: boolean }[];
      };
      luzia_register_open: { Args: { p_app_id: number; p_open_id: string }; Returns: number };
      luzia_can_open: { Args: { p_app_id: number }; Returns: boolean };
      admin_save_application: {
        Args: {
          p_app_id: number | null;
          p_name: string;
          p_description: string | null;
          p_url: string;
          p_icon: string | null;
          p_status: boolean;
          p_audience: "todos" | "selecionados";
          p_dpto_ids: number[];
        };
        Returns: number;
      };
      admin_change_identity: {
        Args: { p_user_id: number; p_new_auth_user_id: string | null; p_new_email: string; p_reason: string };
        Returns: undefined;
      };
      report_scope_users: {
        Args: Record<string, never>;
        Returns: { user_id: number; user_name: string; user_email: string; user_dpto: number | null; user_role: DbCargo }[];
      };
      report_app_names: { Args: Record<string, never>; Returns: { app_id: number; app_name: string }[] };
      report_access_metrics: { Args: ReportFilters; Returns: ReportMetrics };
      report_access_page: { Args: ReportFilters & { p_limit: number; p_offset: number }; Returns: ReportPageRow[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
