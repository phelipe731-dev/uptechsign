import api from "./api";

export interface SmtpSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
  smtp_from_name: string;
}

export interface SmtpSettingsResponse {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password_set: boolean;
  smtp_from: string;
  smtp_from_name: string;
  configured: boolean;
}

export interface InstitutionSettings {
  signature_name: string;
  signature_profile: string;
  certificate_password: string;
  legal_entity_name: string;
  legal_address: string;
  support_email: string;
  support_whatsapp: string;
  support_url: string;
  privacy_contact_email: string;
  dpa_contact_email: string;
}

export interface InstitutionSettingsResponse {
  certificate_configured: boolean;
  certificate_uploaded: boolean;
  certificate_filename: string | null;
  certificate_password_set: boolean;
  signature_name: string;
  signature_profile: string;
  signer_name: string | null;
  issuer_name: string | null;
  certificate_serial: string | null;
  valid_until: string | null;
  certificate_error: string | null;
  legal_entity_name: string;
  legal_address: string;
  support_email: string;
  support_whatsapp: string;
  support_url: string;
  privacy_contact_email: string;
  dpa_contact_email: string;
}

export interface PublicProfile {
  app_name: string;
  legal_entity_name: string;
  legal_address: string;
  support_email: string;
  support_whatsapp: string;
  support_url: string;
  privacy_contact_email: string;
  dpa_contact_email: string;
  base_url: string;
  terms_url: string;
  privacy_url: string;
  dpa_url: string;
  legal_terms_version: string;
}

export interface EmailTemplateEntry {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  subject: string;
  body_html: string;
}

export interface EmailTemplatesResponse {
  templates: EmailTemplateEntry[];
}

export async function getSmtpSettings(): Promise<SmtpSettingsResponse> {
  const res = await api.get<SmtpSettingsResponse>("/settings/smtp");
  return res.data;
}

export async function updateSmtpSettings(data: SmtpSettings): Promise<SmtpSettingsResponse> {
  const res = await api.put<SmtpSettingsResponse>("/settings/smtp", data);
  return res.data;
}

export async function testSmtp(to: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>("/settings/smtp/test", { to });
  return res.data;
}

export async function getInstitutionSettings(): Promise<InstitutionSettingsResponse> {
  const res = await api.get<InstitutionSettingsResponse>("/settings/institution");
  return res.data;
}

export async function getPublicProfile(): Promise<PublicProfile> {
  const res = await api.get<PublicProfile>("/settings/public-profile/public");
  return res.data;
}

export async function updateInstitutionSettings(
  data: InstitutionSettings
): Promise<InstitutionSettingsResponse> {
  const res = await api.put<InstitutionSettingsResponse>("/settings/institution", data);
  return res.data;
}

export async function uploadInstitutionCertificate(
  file: File
): Promise<InstitutionSettingsResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<InstitutionSettingsResponse>("/settings/institution/certificate", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getEmailTemplates(): Promise<EmailTemplatesResponse> {
  const res = await api.get<EmailTemplatesResponse>("/settings/email-templates");
  return res.data;
}

export async function updateEmailTemplates(
  templates: EmailTemplateEntry[]
): Promise<EmailTemplatesResponse> {
  const res = await api.put<EmailTemplatesResponse>("/settings/email-templates", { templates });
  return res.data;
}
