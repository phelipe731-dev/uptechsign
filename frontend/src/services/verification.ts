import axios from "axios";

const publicApi = axios.create({ baseURL: "/api" });

export interface VerificationFile {
  id: string;
  kind: string;
  label: string;
  sha256: string;
  created_at: string;
  download_url: string;
}

export interface VerificationSignatory {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  role_label: string | null;
  status: string;
  signing_order: number;
  auth_method: string;
  auth_require_email_otp: boolean;
  viewed_at: string | null;
  identity_name: string | null;
  identity_email: string | null;
  identity_phone: string | null;
  identity_confirmed_at: string | null;
  otp_sent_at: string | null;
  otp_verified_at: string | null;
  terms_accepted_at: string | null;
  accepted_terms_version: string | null;
  signed_at: string | null;
  refused_at: string | null;
  signature_mode: string | null;
  ip_address_at_sign: string | null;
  user_agent_at_sign: string | null;
}

export interface VerificationIntegrity {
  configured: boolean;
  signer_name: string | null;
  issuer_name: string | null;
  certificate_serial: string | null;
  valid_until: string | null;
  profile: string | null;
}

export interface VerificationDocument {
  document_id: string;
  document_title: string;
  status: string;
  source_type: string;
  verification_code: string;
  verification_url: string;
  created_at: string;
  completed_at: string | null;
  signatories_count: number;
  signed_signatories_count: number;
  public_data_masked: boolean;
  integrity: VerificationIntegrity;
  hashes: VerificationFile[];
  signatories: VerificationSignatory[];
}

export async function getVerificationDocument(
  code: string
): Promise<VerificationDocument> {
  const res = await publicApi.get<VerificationDocument>(`/verify/${code}`);
  return res.data;
}
