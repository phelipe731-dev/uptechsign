import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, Download, FileCheck, Shield, XCircle } from "lucide-react";
import {
  getVerificationDocument,
  type VerificationDocument,
  type VerificationFile,
} from "../services/verification";
import PhSignLogo from "../components/branding/PhSignLogo";
import PublicLegalFooter from "../components/legal/PublicLegalFooter";

const statusLabels: Record<string, string> = {
  generated: "Gerado",
  sent: "Enviado",
  pending: "Pendente",
  viewed: "Visualizado",
  in_signing: "Em assinatura",
  identity_confirmed: "Identidade confirmada",
  otp_verified: "OTP validado",
  signed: "Assinado",
  completed: "Concluido",
  refused: "Recusado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const statusStyles: Record<string, string> = {
  generated: "bg-[#F7F9FC] text-[#A0AEC0]",
  sent: "bg-[#FFF7ED] text-[#D97706]",
  pending: "bg-[#F7F9FC] text-[#A0AEC0]",
  viewed: "bg-sky-50 text-sky-700",
  in_signing: "bg-[#FFF7ED] text-[#D97706]",
  identity_confirmed: "bg-indigo-50 text-indigo-700",
  otp_verified: "bg-cyan-50 text-cyan-700",
  signed: "bg-green-50 text-[#22C55E]",
  completed: "bg-green-50 text-[#22C55E]",
  refused: "bg-red-50 text-[#EF4444]",
  expired: "bg-[#F7F9FC] text-[#A0AEC0]",
  cancelled: "bg-[#F7F9FC] text-[#A0AEC0]",
};

export default function VerifyDocument() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<VerificationDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    void loadVerification(code);
  }, [code]);

  async function loadVerification(verificationCode: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await getVerificationDocument(verificationCode);
      setData(response);
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="py-16 text-center text-sm text-[#A0AEC0]">
          Validando documento...
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <div className="py-16 text-center">
          <XCircle size={52} className="mx-auto mb-4 text-[#EF4444]" />
          <h2 className="text-xl font-bold text-[#000]">Codigo nao encontrado</h2>
          <p className="mt-2 text-sm text-[#4A5568]">{error ?? "Documento indisponivel."}</p>
        </div>
      </PageShell>
    );
  }

  const signedFile = data.hashes.find((item) => item.kind === "signed_pdf");
  const certificateFile = data.hashes.find((item) => item.kind === "certificate_pdf");

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-[#000]">{data.document_title}</h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    statusStyles[data.status] ?? "bg-[#F7F9FC] text-[#A0AEC0]"
                  }`}
                >
                  {statusLabels[data.status] ?? data.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#4A5568]">
                Codigo de verificacao{" "}
                <span className="font-mono text-[#1A202C]">{data.verification_code}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {signedFile && <DownloadButton file={signedFile} label="Baixar PDF assinado" />}
              {certificateFile && (
                <DownloadButton file={certificateFile} label="Baixar certificado" />
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryCard
              label="Criado em"
              value={formatDateTime(data.created_at)}
              icon={<FileCheck size={16} className="text-[#F59E0B]" />}
            />
            <SummaryCard
              label="Concluido em"
              value={data.completed_at ? formatDateTime(data.completed_at) : "Ainda em andamento"}
              icon={<CheckCircle size={16} className="text-[#22C55E]" />}
            />
            <SummaryCard
              label="Origem"
              value={data.source_type === "manual" ? "PDF manual" : "Template DOCX"}
              icon={<Shield size={16} className="text-indigo-600" />}
            />
            <SummaryCard
              label="Assinaturas"
              value={`${data.signed_signatories_count}/${data.signatories_count}`}
              icon={<CheckCircle size={16} className="text-[#F59E0B]" />}
            />
          </div>

          {data.public_data_masked && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-[#FFF7ED] px-4 py-3 text-sm text-[#D97706]">
              Dados pessoais sensiveis dos signatarios aparecem mascarados nesta consulta publica.
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#000]">Integridade institucional</h2>
              <p className="mt-1 text-sm text-[#4A5568]">
                Status da selagem final do PDF pela instituicao responsavel pela plataforma.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                data.integrity.configured
                  ? "bg-green-50 text-[#22C55E]"
                  : "bg-[#FFF7ED] text-[#D97706]"
              }`}
            >
              {data.integrity.configured ? "ICP institucional ativo" : "ICP institucional pendente"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EvidenceItem label="Perfil" value={data.integrity.profile || "-"} />
            <EvidenceItem label="Titular" value={data.integrity.signer_name || "-"} />
            <EvidenceItem label="Emissor" value={data.integrity.issuer_name || "-"} />
            <EvidenceItem
              label="Validade do certificado"
              value={formatDateTime(data.integrity.valid_until)}
            />
            <EvidenceItem
              label="Serial do certificado"
              value={data.integrity.certificate_serial || "-"}
              fullWidth
            />
          </div>
        </div>

        <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#000]">Hashes dos arquivos</h2>
          <div className="mt-4 space-y-3">
            {data.hashes.map((hash) => (
              <div
                key={hash.id}
                className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#000]">{hash.label}</div>
                    <div className="mt-1 font-mono text-xs text-[#4A5568] break-all">
                      {hash.sha256}
                    </div>
                  </div>
                  {(hash.kind === "signed_pdf" || hash.kind === "certificate_pdf") && (
                    <DownloadButton file={hash} label="Baixar" compact />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#000]">Evidencias por signatario</h2>
          <div className="mt-4 space-y-4">
            {data.signatories.map((signatory) => (
              <div key={signatory.id} className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[#000]">
                      {signatory.name}
                      {signatory.role_label && (
                        <span className="ml-2 text-sm font-normal text-[#4A5568]">
                          {signatory.role_label}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-[#4A5568]">{signatory.email}</div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      statusStyles[signatory.status] ?? "bg-[#F7F9FC] text-[#A0AEC0]"
                    }`}
                  >
                    {statusLabels[signatory.status] ?? signatory.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <EvidenceItem label="Ordem" value={signatory.signing_order ? String(signatory.signing_order) : "Livre"} />
                  <EvidenceItem label="Metodo" value={signatory.auth_method} />
                  <EvidenceItem
                    label="OTP"
                    value={signatory.auth_require_email_otp ? "Obrigatorio por email" : "Nao exigido"}
                  />
                  <EvidenceItem label="Nome confirmado" value={signatory.identity_name || "-"} />
                  <EvidenceItem label="Telefone" value={signatory.identity_phone || "-"} />
                  <EvidenceItem label="CPF" value={signatory.cpf || "-"} />
                  <EvidenceItem label="Visualizado em" value={formatDateTime(signatory.viewed_at)} />
                  <EvidenceItem
                    label="Identidade confirmada"
                    value={formatDateTime(signatory.identity_confirmed_at)}
                  />
                  <EvidenceItem label="OTP enviado em" value={formatDateTime(signatory.otp_sent_at)} />
                  <EvidenceItem
                    label="OTP validado em"
                    value={formatDateTime(signatory.otp_verified_at)}
                  />
                  <EvidenceItem
                    label="Aceite registrado"
                    value={formatDateTime(signatory.terms_accepted_at)}
                  />
                  <EvidenceItem
                    label="Versao dos termos"
                    value={signatory.accepted_terms_version || "-"}
                  />
                  <EvidenceItem label="Assinado em" value={formatDateTime(signatory.signed_at)} />
                  <EvidenceItem
                    label="Selfie capturada"
                    value={signatory.selfie_captured ? "Sim" : "Nao"}
                  />
                  <EvidenceItem label="IP da assinatura" value={signatory.ip_address_at_sign || "-"} />
                  <EvidenceItem label="Modo de assinatura" value={signatory.signature_mode || "-"} />
                  <EvidenceItem
                    label="Dispositivo"
                    value={signatory.user_agent_at_sign || "-"}
                    fullWidth
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-[#4A5568]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-[#000]">{value}</div>
    </div>
  );
}

function EvidenceItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2 xl:col-span-3" : ""}>
      <div className="text-xs uppercase tracking-wide text-[#A0AEC0]">{label}</div>
      <div className="mt-1 text-sm text-[#4A5568] break-words">{value}</div>
    </div>
  );
}

function DownloadButton({
  file,
  label,
  compact = false,
}: {
  file: VerificationFile;
  label: string;
  compact?: boolean;
}) {
  return (
    <a
      href={file.download_url}
      className={`inline-flex items-center gap-2 rounded-lg transition-colors ${
        compact
          ? "bg-white px-3 py-2 text-sm font-medium text-[#F59E0B] hover:bg-[#FFF7ED]"
          : "bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D97706]"
      }`}
    >
      <Download size={16} />
      {label}
    </a>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="border-b border-[#E6EAF0] bg-white">
        <div className="h-1 bg-[#F59E0B]" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <PhSignLogo className="h-12 w-auto" />
          <div className="text-right text-[11px] font-medium uppercase tracking-[0.2em] text-[#A0AEC0]">
            verificacao publica
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {children}
        <PublicLegalFooter compact />
      </div>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as {
      response?: {
        data?: {
          detail?: string;
        };
      };
    }).response;
    return response?.data?.detail ?? "Erro ao validar documento.";
  }
  return "Erro de conexao.";
}
