export interface UserSignatureData {
  default_mode: "drawn" | "typed";
  typed_name: string;
  signature_image_base64: string | null;
  initials: string | null;
  updated_at: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  is_active: boolean;
  signature_data?: UserSignatureData | null;
  created_at: string;
}

export interface TemplateField {
  key: string;
  label: string; // exact DOCX placeholder text
  display_label?: string; // user-friendly UI label
  required: boolean;
  display_order: number;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  fields: TemplateField[];
  is_active: boolean;
  created_at: string;
}

export interface DocumentFile {
  id: string;
  kind: "source_docx" | "generated_pdf" | "signed_pdf" | "certificate_pdf";
  sha256: string;
  version_number: number;
  is_current: boolean;
  superseded_at: string | null;
  created_at: string;
}

export interface SignatureField {
  id: string;
  document_id: string;
  signatory_id: string;
  page: number;
  field_type: "signature" | "initials" | "text";
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
  filled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  template_id: string | null;
  template_name: string | null;
  verification_code: string;
  source_type: "template" | "manual";
  status: string;
  field_data: Record<string, string>;
  created_by_id: string | null;
  current_signing_order: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_activity_at: string | null;
  signatories_count: number;
  signed_signatories_count: number;
  pending_signatories_count: number;
  files: DocumentFile[];
}

export interface DocumentListItem {
  id: string;
  title: string;
  status: string;
  template_id: string | null;
  template_name: string | null;
  verification_code: string;
  source_type: "template" | "manual";
  created_at: string;
  last_activity_at: string | null;
  signatories_count: number;
  signed_signatories_count: number;
}

export interface PaginatedDocuments {
  items: DocumentListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface PayrollBatchItem {
  id: string;
  row_number: number;
  employee_label: string | null;
  status: "pending" | "generated" | "failed";
  row_data: Record<string, string>;
  field_data: Record<string, string>;
  pdf_filename: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollBatchListItem {
  id: string;
  name: string;
  template_id: string;
  template_name: string | null;
  status: "draft" | "generating" | "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  generated_rows: number;
  failed_rows: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  zip_ready: boolean;
}

export interface PayrollBatch {
  id: string;
  name: string;
  template_id: string;
  template_name: string | null;
  status: "draft" | "generating" | "completed" | "completed_with_errors" | "failed";
  csv_filename: string | null;
  headers: string[];
  column_mapping: Record<string, string>;
  total_rows: number;
  generated_rows: number;
  failed_rows: number;
  zip_sha256: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  template_fields: TemplateField[];
  preview_items: PayrollBatchItem[];
  preview_truncated: boolean;
  zip_ready: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
