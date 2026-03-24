export interface AuditLogEntry {
  id: number;
  actor_type: string;
  actor_id: string | null;
  document_id: string | null;
  action: string;
  details: Record<string, string> | null;
  ip_address: string | null;
  created_at: string;
}
