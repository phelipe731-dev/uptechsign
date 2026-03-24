import api from "./api";
import type { Document, PaginatedDocuments, Template, TemplateField } from "../types";

export async function getTemplates(): Promise<Template[]> {
  const res = await api.get<Template[]>("/templates/");
  return res.data;
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await api.get<Template>(`/templates/${id}`);
  return res.data;
}

export async function createDocument(data: {
  template_id: string;
  title: string;
  field_data: Record<string, string>;
}): Promise<Document> {
  const res = await api.post<Document>("/documents/", data);
  return res.data;
}

export async function uploadPdfDocument(
  file: File,
  title: string
): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  const res = await api.post<Document>("/documents/upload-pdf", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function replaceDocumentPdf(
  documentId: string,
  file: File,
  title?: string
): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  if (title) {
    form.append("title", title);
  }
  const res = await api.post<Document>(`/documents/${documentId}/upload-pdf`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getDocuments(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  template_id?: string;
  source?: string;
  search?: string;
}): Promise<PaginatedDocuments> {
  const res = await api.get<PaginatedDocuments>("/documents/", { params });
  return res.data;
}

export async function getDocumentAudit(
  documentId: string
): Promise<
  {
    id: number;
    actor_type: string;
    actor_id?: string | null;
    actor_label?: string | null;
    document_id: string | null;
    document_title?: string | null;
    action: string;
    details: Record<string, unknown> | null;
    chain_scope: string;
    prev_entry_hash?: string | null;
    entry_hash: string;
    chain_ok?: boolean | null;
    ip_address: string | null;
    user_agent?: string | null;
    created_at: string;
  }[]
> {
  const res = await api.get(`/documents/${documentId}/audit`);
  return res.data;
}

export async function getDocument(id: string): Promise<Document> {
  const res = await api.get<Document>(`/documents/${id}`);
  return res.data;
}

export function getFileDownloadUrl(
  documentId: string,
  fileId: string
): string {
  return `/api/documents/${documentId}/files/${fileId}/download`;
}

// --- Template management (admin) ---

export interface DetectedField {
  label: string;
  suggested_key: string;
  display_order: number;
}

export async function uploadTemplate(
  file: File,
  name: string,
  description: string
): Promise<Template> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  form.append("description", description);
  const res = await api.post<Template>("/templates/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function updateTemplateFields(
  id: string,
  name: string,
  description: string,
  fields: TemplateField[]
): Promise<Template> {
  const form = new FormData();
  form.append("name", name);
  form.append("description", description);
  form.append("fields", JSON.stringify(fields));
  const res = await api.put<Template>(`/templates/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function replaceTemplateFile(id: string, file: File): Promise<Template> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.put<Template>(`/templates/${id}/file`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function detectTemplateFields(id: string): Promise<{ detected: DetectedField[] }> {
  const res = await api.get<{ detected: DetectedField[] }>(`/templates/${id}/detect-fields`);
  return res.data;
}

export async function deactivateTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`);
}
