// Tipos escritos à mão a partir de supabase/migrations/20261020100000_luzia_foundation.sql.
// Substituir por `supabase gen types typescript` (filtrando luzia_) quando houver acesso ao projeto (X-01/X-02).

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type DbCargo = "usuario" | "lider" | "coordenador" | "gerente" | "diretor";
export type DbAccessStatus = "active" | "inactive";
export type DbDepartmentKind = "regular" | "provisioning";
export type DbAudience = "all_departments" | "selected_departments";
export type DbPhase = "coexistence" | "primary";

export type DepartmentRow = {
  id: number;
  name: string;
  kind: DbDepartmentKind;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type CollaboratorRow = {
  id: number;
  auth_user_id: string | null;
  name: string;
  email: string;
  department_id: number;
  role: DbCargo;
  is_admin: boolean;
  access_status: DbAccessStatus;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  legacy_app_id: number | null;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  active: boolean;
  audience: DbAudience;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ApplicationDepartmentRow = {
  application_id: string;
  department_id: number;
  created_at: string;
};

export type AccessEventRow = {
  id: number;
  open_id: string;
  collaborator_id: number;
  application_id: string;
  opened_at: string;
};

export type NewsRow = {
  id: string;
  title: string;
  body: string;
  version: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type AuditEventRow = {
  id: number;
  created_at: string;
  actor_auth_id: string | null;
  actor_collaborator_id: number | null;
  action: string;
  entity: string;
  entity_id: string;
  changes: Record<string, unknown>;
  reason: string | null;
};

export type ReportMetrics = {
  total_opens: number;
  distinct_collaborators: number;
  top_applications: { application_id: string; name: string | null; total: number }[];
  daily: { day: string; total: number }[];
};

export type ReportPageRow = {
  event_id: number;
  opened_at: string;
  collaborator_id: number;
  collaborator_name: string;
  department_id: number | null;
  department_name: string | null;
  application_id: string;
  application_name: string | null;
  total_count: number;
};

export type MyProfile = {
  collaborator_id: number;
  name: string;
  email: string;
  role: DbCargo;
  is_admin: boolean;
  access_status: DbAccessStatus;
  department_id: number | null;
  department_name: string | null;
  department_kind: DbDepartmentKind | null;
  phase: DbPhase;
};

type ReportFilters = {
  p_from: string;
  p_to: string;
  p_application_id?: string | null;
  p_collaborator_id?: number | null;
  p_department_id?: number | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      luzia_departments: Table<DepartmentRow>;
      luzia_collaborators: Table<CollaboratorRow>;
      luzia_applications: Table<ApplicationRow>;
      luzia_application_departments: Table<ApplicationDepartmentRow>;
      luzia_access_events: Table<AccessEventRow>;
      luzia_news: Table<NewsRow>;
      luzia_audit_events: Table<AuditEventRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      luzia_provision_me: { Args: Record<string, never>; Returns: { collaborator_id: number; access_status: string; outcome: string }[] };
      luzia_my_profile: { Args: Record<string, never>; Returns: MyProfile[] };
      luzia_can_open: { Args: { p_application_id: string }; Returns: boolean };
      luzia_register_open: { Args: { p_application_id: string; p_open_id: string }; Returns: number };
      luzia_admin_save_department: { Args: { p_id: number | null; p_name: string }; Returns: number };
      luzia_admin_set_department_active: { Args: { p_id: number; p_active: boolean }; Returns: undefined };
      luzia_admin_update_collaborator: {
        Args: { p_id: number; p_department_id: number; p_role: DbCargo; p_is_admin: boolean; p_access_status: DbAccessStatus };
        Returns: undefined;
      };
      luzia_admin_change_identity: { Args: { p_id: number; p_new_auth_user_id: string | null; p_new_email: string; p_reason: string }; Returns: undefined };
      luzia_admin_save_application: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_description: string | null;
          p_url: string;
          p_icon: string | null;
          p_active: boolean;
          p_audience: DbAudience;
          p_department_ids: number[];
        };
        Returns: string;
      };
      luzia_admin_save_news: {
        Args: { p_id: string | null; p_title: string; p_body: string; p_version: string | null; p_published_at: string };
        Returns: string;
      };
      luzia_admin_adopt_legacy_collaborators: { Args: Record<string, never>; Returns: number };
      luzia_report_scope: {
        Args: Record<string, never>;
        Returns: { collaborator_id: number; name: string; email: string; department_id: number | null; role: DbCargo }[];
      };
      luzia_report_application_names: { Args: Record<string, never>; Returns: { application_id: string; name: string }[] };
      luzia_report_access_metrics: { Args: ReportFilters; Returns: ReportMetrics };
      luzia_report_access_page: { Args: ReportFilters & { p_limit: number; p_offset: number }; Returns: ReportPageRow[] };
    };
    Enums: {
      luzia_hierarchy_role: DbCargo;
      luzia_access_status: DbAccessStatus;
      luzia_department_kind: DbDepartmentKind;
      luzia_audience: DbAudience;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
