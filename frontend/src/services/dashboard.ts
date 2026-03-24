import api from "./api";

export interface DashboardStats {
  total: number;
  generated: number;
  sent: number;
  in_signing: number;
  completed: number;
  refused: number;
  expired: number;
  cancelled: number;
}

export interface ActivityItem {
  id: number;
  actor_type: string;
  actor_label: string | null;
  document_id: string | null;
  document_title: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PendingDocumentItem {
  id: string;
  title: string;
  status: string;
  template_name: string | null;
  source_type: "template" | "manual";
  created_at: string;
  last_activity_at: string | null;
  signatories_count: number;
  signed_signatories_count: number;
  pending_signatories_count: number;
  waiting_for: string | null;
  current_signing_order: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>("/dashboard/stats");
  return res.data;
}

export async function getDashboardActivity(
  limit = 20
): Promise<ActivityItem[]> {
  const res = await api.get<ActivityItem[]>("/dashboard/activity", {
    params: { limit },
  });
  return res.data;
}

export async function getDashboardPending(
  limit = 6
): Promise<PendingDocumentItem[]> {
  const res = await api.get<PendingDocumentItem[]>("/dashboard/pending", {
    params: { limit },
  });
  return res.data;
}

export async function getDashboardRecent(
  limit = 20
): Promise<ActivityItem[]> {
  const res = await api.get<ActivityItem[]>("/dashboard/recent", {
    params: { limit },
  });
  return res.data;
}
