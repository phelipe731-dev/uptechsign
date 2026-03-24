import axios from "axios";
import api from "./api";
import type { SignatureField } from "../types";

// Public API (no auth) - uses axios directly
const publicApi = axios.create({ baseURL: "/api" });

export interface PublicSignatureFieldInfo {
  id: string;
  page: number;
  field_type: "signature" | "initials" | "text";
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
}

export interface PublicDocumentInfo {
  document_title: string;
  signatory_name: string;
  signatory_role: string | null;
  status: string;
  identity_confirmed: boolean;
  requires_otp: boolean;
  require_full_name: boolean;
  require_email: boolean;
  require_cpf: boolean;
  terms_version: string;
  terms_summary: string;
  fields: PublicSignatureFieldInfo[];
}

export async function getSigningInfo(
  token: string
): Promise<PublicDocumentInfo> {
  const res = await publicApi.get<PublicDocumentInfo>(`/sign/${token}`);
  return res.data;
}

export function getSigningPdfUrl(token: string): string {
  return `/api/sign/${token}/pdf`;
}

export async function confirmIdentity(
  token: string,
  data: {
    full_name: string;
    email: string;
    cpf?: string;
    phone_country_code?: string;
    phone_number?: string;
  }
): Promise<{ message: string; requires_otp: boolean }> {
  const res = await publicApi.post(`/sign/${token}/confirm-identity`, data);
  return res.data;
}

export async function requestOtp(
  token: string
): Promise<{
  message: string;
  email_hint: string;
  cooldown_seconds: number;
  debug_code?: string | null;
}> {
  const res = await publicApi.post(`/sign/${token}/otp/request`);
  return res.data;
}

export async function verifyOtp(
  token: string,
  code: string
): Promise<{ message: string }> {
  const res = await publicApi.post(`/sign/${token}/otp/verify`, { code });
  return res.data;
}

export async function submitSignature(
  token: string,
  data: {
    typed_name: string;
    signature_mode: "drawn" | "typed";
    signature_image_base64?: string;
    field_values?: Record<string, string>;
    accept_terms: boolean;
  }
): Promise<{ message: string; document_completed: boolean }> {
  const res = await publicApi.post(`/sign/${token}/sign`, data);
  return res.data;
}

export async function refuseSignature(
  token: string,
  reason?: string
): Promise<{ message: string }> {
  const res = await publicApi.post(`/sign/${token}/refuse`, { reason });
  return res.data;
}

// Authenticated API for document management
export interface SignatoryData {
  name: string;
  email: string;
  cpf?: string;
  phone_country_code?: string;
  phone_number?: string;
  role_label?: string;
  signing_order?: number;
  auth_method?: string;
  auth_require_email_otp?: boolean;
  auth_require_full_name?: boolean;
  auth_require_cpf?: boolean;
}

export interface SignatoryInfo {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  role_label: string | null;
  signing_order: number;
  token: string;
  status: string;
  auth_method: string;
  auth_require_email_otp: boolean;
  auth_require_full_name: boolean;
  auth_require_cpf: boolean;
  sent_at: string | null;
  viewed_at: string | null;
  identity_confirmed_at: string | null;
  verified_at: string | null;
  signed_at: string | null;
  refused_at: string | null;
  created_at: string;
}

export async function sendForSigning(
  documentId: string,
  signatories: SignatoryData[]
): Promise<SignatoryInfo[]> {
  const res = await api.post<SignatoryInfo[]>(
    `/documents/${documentId}/send`,
    { signatories }
  );
  return res.data;
}

export async function getSignatories(
  documentId: string
): Promise<SignatoryInfo[]> {
  const res = await api.get<SignatoryInfo[]>(
    `/documents/${documentId}/signatories`
  );
  return res.data;
}

export async function createSignatory(
  documentId: string,
  data: SignatoryData
): Promise<SignatoryInfo> {
  const res = await api.post<SignatoryInfo>(
    `/documents/${documentId}/signatories`,
    data
  );
  return res.data;
}

export async function updateSignatory(
  signatoryId: string,
  data: Partial<SignatoryData>
): Promise<SignatoryInfo> {
  const res = await api.patch<SignatoryInfo>(`/signatories/${signatoryId}`, data);
  return res.data;
}

export async function deleteSignatory(signatoryId: string): Promise<void> {
  await api.delete(`/signatories/${signatoryId}`);
}

export async function getSignatureFields(
  documentId: string
): Promise<SignatureField[]> {
  const res = await api.get<SignatureField[]>(`/documents/${documentId}/fields`);
  return res.data;
}

export async function createSignatureField(
  documentId: string,
  data: {
    signatory_id: string;
    page: number;
    field_type: "signature" | "initials" | "text";
    label?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
  }
): Promise<SignatureField> {
  const res = await api.post<SignatureField>(`/documents/${documentId}/fields`, data);
  return res.data;
}

export async function updateSignatureField(
  fieldId: string,
  data: Partial<{
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
  }>
): Promise<SignatureField> {
  const res = await api.patch<SignatureField>(`/fields/${fieldId}`, data);
  return res.data;
}

export async function deleteSignatureField(fieldId: string): Promise<void> {
  await api.delete(`/fields/${fieldId}`);
}

export async function cancelDocument(documentId: string): Promise<void> {
  await api.post(`/documents/${documentId}/cancel`);
}

export async function resendSigningLink(
  documentId: string,
  signatoryId: string
): Promise<void> {
  await api.post(`/documents/${documentId}/signatories/${signatoryId}/resend`);
}
