import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Filter,
  LayoutTemplate,
  RefreshCw,
  Search,
  Send,
  Shield,
  Upload,
  UserCheck,
  UserX,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocument } from "../hooks/useDocuments";
import { getDocumentAudit, replaceDocumentPdf } from "../services/documents";
import {
  cancelDocument,
  getSignatureFields,
  getSignatories,
  resendSigningLink,
  sendForSigning,
} from "../services/signatures";
import type { SignatoryInfo } from "../services/signatures";
import api from "../services/api";
import SignatoryManager from "../components/documents/SignatoryManager";
import SignatureFieldEditor from "../components/documents/SignatureFieldEditor";

const kindLabels: Record<string, string> = {
  source_docx: "DOCX original",
  generated_pdf: "PDF base",
  signed_pdf: "PDF assinado",
  certificate_pdf: "Certificado",
};

const statusLabels: Record<string, string> = {
  generated: "Gerado",
  sent: "Enviado",
  in_signing: "Em assinatura",
  completed: "Concluido",
  refused: "Recusado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  generated: "bg-gray-100 text-gray-600",
  sent: "bg-orange-50 text-orange-700",
  in_signing: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  refused: "bg-red-50 text-red-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

const sigStatusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  pending: { label: "Pendente", color: "text-gray-400", icon: Clock },
  sent: { label: "Enviado", color: "text-orange-600", icon: Send },
  viewed: { label: "Visualizado", color: "text-sky-600", icon: Eye },
  identity_confirmed: { label: "Identidade confirmada", color: "text-indigo-600", icon: UserCheck },
  otp_verified: { label: "OTP verificado", color: "text-cyan-600", icon: Shield },
  signed: { label: "Assinado", color: "text-emerald-600", icon: Check },
  refused: { label: "Recusado", color: "text-red-600", icon: UserX },
};

const actionLabels: Record<string, string> = {
  "document.created": "Documento criado",
  "document.sent": "Enviado para assinatura",
  "document.completed": "Todas as assinaturas concluidas",
  "document.cancelled": "Documento cancelado",
  "document.pdf_uploaded": "PDF manual enviado",
  "document.pdf_replaced": "PDF substituido",
  "document.partial_pdf_updated": "PDF parcial atualizado",
  "document.downloaded": "Arquivo baixado",
  "document.verified_public": "Verificacao publica consultada",
  "document.downloaded_public": "Download publico realizado",
  "signatory.created": "Signatario adicionado",
  "signatory.updated": "Signatario atualizado",
  "signatory.deleted": "Signatario removido",
  "field.created": "Campo posicionado",
  "field.updated": "Campo atualizado",
  "field.deleted": "Campo removido",
  "signature.viewed": "Signatario visualizou",
  "identity.confirmed": "Identidade confirmada",
  "otp.sent": "OTP enviado",
  "otp.verified": "OTP validado",
  "terms.accepted": "Termos aceitos",
  "signature.signed": "Documento assinado",
  "signature.refused": "Assinatura recusada",
  "signature.resent": "Link reenviado",
};

const actionColors: Record<string, string> = {
  "document.created": "bg-orange-500",
  "document.sent": "bg-amber-500",
  "document.completed": "bg-emerald-500",
  "document.cancelled": "bg-gray-400",
  "document.pdf_uploaded": "bg-indigo-500",
  "document.pdf_replaced": "bg-indigo-500",
  "document.partial_pdf_updated": "bg-teal-500",
  "document.downloaded": "bg-slate-500",
  "document.verified_public": "bg-cyan-500",
  "document.downloaded_public": "bg-slate-500",
  "signatory.created": "bg-orange-500",
  "signatory.updated": "bg-indigo-500",
  "signatory.deleted": "bg-red-400",
  "field.created": "bg-emerald-500",
  "field.updated": "bg-teal-500",
  "field.deleted": "bg-red-400",
  "signature.viewed": "bg-sky-500",
  "identity.confirmed": "bg-indigo-500",
  "otp.sent": "bg-orange-500",
  "otp.verified": "bg-cyan-500",
  "terms.accepted": "bg-violet-500",
  "signature.signed": "bg-emerald-500",
  "signature.refused": "bg-red-500",
  "signature.resent": "bg-purple-500",
};

async function downloadFileBlob(documentId: string, fileId: string, filename: string) {
  const response = await api.get(`/documents/${documentId}/files/${fileId}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data as BlobPart], {
    type: (response.headers["content-type"] as string) || "application/octet-stream",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function fetchPdfBlobUrl(documentId: string, fileId: string): Promise<string> {
  const response = await api.get(`/documents/${documentId}/files/${fileId}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

function renderFieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Nao informado";
  }
  return String(value);
}

function extractApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as {
      response?: {
        data?: {
          detail?:
            | string
            | Array<{
                msg?: string;
              }>;
        };
      };
    }).response;
    const detail = response?.data?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg ?? "Erro inesperado.";
    }
    return typeof detail === "string" ? detail : "Erro inesperado.";
  }
  return "Erro inesperado.";
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: doc, isLoading } = useDocument(id);

  const { data: signatories = [] } = useQuery({
    queryKey: ["signatories", id],
    queryFn: () => getSignatories(id!),
    enabled: !!id,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["signature-fields", id],
    queryFn: () => getSignatureFields(id!),
    enabled: !!id,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["document-audit", id],
    queryFn: () => getDocumentAudit(id!),
    enabled: !!id,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [verificationCopied, setVerificationCopied] = useState(false);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["signatories", id] });
    queryClient.invalidateQueries({ queryKey: ["signature-fields", id] });
    queryClient.invalidateQueries({ queryKey: ["document", id] });
    queryClient.invalidateQueries({ queryKey: ["document-audit", id] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      await sendForSigning(id!, []);
      invalidateAll();
    } catch (err: unknown) {
      setSendError(extractApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancelar este documento? Esta acao nao pode ser desfeita.")) return;
    try {
      await cancelDocument(id!);
      invalidateAll();
    } catch {
      /* ignore */
    }
  }

  async function handleReplacePdf() {
    if (!pdfFile) {
      setPdfError("Selecione um PDF para substituir o documento.");
      return;
    }

    setPdfBusy(true);
    setPdfError(null);
    try {
      await replaceDocumentPdf(id!, pdfFile, pdfTitle.trim() || undefined);
      setPdfFile(null);
      setPdfTitle("");
      invalidateAll();
    } catch (err: unknown) {
      setPdfError(extractApiError(err));
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePreviewPdf(fileId: string) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const url = await fetchPdfBlobUrl(id!, fileId);
      setPreviewUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  }

  function copySigningLink(token: string, signatoryId: string) {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(signatoryId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyVerificationLink() {
    const url = `${window.location.origin}/verify/${doc?.verification_code}`;
    navigator.clipboard.writeText(url).then(() => {
      setVerificationCopied(true);
      setTimeout(() => setVerificationCopied(false), 2000);
    });
  }

  async function handleResend(signatoryId: string) {
    try {
      await resendSigningLink(id!, signatoryId);
      setResentId(signatoryId);
      setTimeout(() => setResentId(null), 2500);
      invalidateAll();
    } catch {
      /* ignore */
    }
  }

  const filteredAuditLogs = useMemo(() => {
    const search = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesFilter = auditFilter === "all" || log.action.startsWith(auditFilter);
      if (!matchesFilter) {
        return false;
      }
      if (!search) {
        return true;
      }

      const haystack = [
        actionLabels[log.action] ?? log.action,
        log.actor_label,
        log.document_title,
        log.ip_address,
        log.user_agent,
        JSON.stringify(log.details ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [auditFilter, auditLogs, auditSearch]);

  if (isLoading) {
    return <div className="p-8 text-gray-500">Carregando...</div>;
  }

  if (!doc) {
    return (
      <div className="p-8">
        <div className="text-red-600">Documento nao encontrado.</div>
        <Link to="/" className="mt-2 inline-block text-sm text-orange-600">
          Voltar
        </Link>
      </div>
    );
  }

  const canSend = doc.status === "generated";
  const canCancel = !["completed", "cancelled"].includes(doc.status);
  const previewableFile =
    doc.files.find((file) => file.kind === "signed_pdf") ??
    doc.files.find((file) => file.kind === "generated_pdf");
  const generatedPdfFile = doc.files.find((file) => file.kind === "generated_pdf");
  const requiredTextFields = fields.filter((field) => field.field_type === "text" && field.required).length;
  const sourceLabel = doc.source_type === "manual" ? "PDF manual" : "Template DOCX";
  const verificationUrl = `${window.location.origin}/verify/${doc.verification_code}`;

  return (
    <div className="max-w-[1500px] p-8">
      <Link
        to="/documents"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-gray-900">{doc.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-xs text-gray-500">
              {new Date(doc.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[doc.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {statusLabels[doc.status] ?? doc.status}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {sourceLabel}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {doc.signed_signatories_count}/{doc.signatories_count} assinaturas
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {fields.length} campo(s)
            </span>
            {requiredTextFields > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {requiredTextFields} texto(s) obrigatorio(s)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {canSend && (
            <button
              onClick={handleSend}
              disabled={sending || signatories.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              <Send size={16} /> {sending ? "Enviando..." : "Enviar para assinatura"}
            </button>
          )}
          {canCancel && doc.status !== "generated" && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600"
            >
              <Ban size={16} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {sendError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sendError}
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
            <span className="text-sm font-medium text-gray-700">Pre-visualizacao do PDF</span>
            <button onClick={closePreview} className="text-gray-400 transition-colors hover:text-gray-700">
              Fechar
            </button>
          </div>
          <iframe src={previewUrl} className="flex-1 w-full" title="PDF Preview" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {canSend && (
            <PdfReplacementCard
              title={pdfTitle || doc.title}
              onTitleChange={setPdfTitle}
              file={pdfFile}
              onFileChange={setPdfFile}
              onSubmit={handleReplacePdf}
              busy={pdfBusy}
              error={pdfError}
            />
          )}

          {canSend && (
            <SignatoryManager
              documentId={doc.id}
              signatories={signatories}
              onChanged={invalidateAll}
            />
          )}

          {canSend && generatedPdfFile && signatories.length > 0 && (
            <SignatureFieldEditor
              documentId={doc.id}
              pdfFileId={generatedPdfFile.id}
              signatories={signatories}
              fields={fields}
              onChanged={invalidateAll}
            />
          )}

          {!canSend && signatories.length > 0 && (
            <ReadonlySignatories
              signatories={signatories}
              copiedId={copiedId}
              resentId={resentId}
              onCopy={copySigningLink}
              onResend={handleResend}
            />
          )}

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Arquivos</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {doc.files.map((file) => {
                const isPdf = file.kind !== "source_docx";
                const ext = file.kind === "source_docx" ? "docx" : "pdf";

                return (
                  <div key={file.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-900">
                          {kindLabels[file.kind] ?? file.kind}
                          <span className="ml-2 text-xs text-gray-400">v{file.version_number}</span>
                        </div>
                        <div className="font-mono text-xs text-gray-400">
                          SHA-256: {file.sha256.slice(0, 18)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isPdf && (
                        <button
                          onClick={() => handlePreviewPdf(file.id)}
                          disabled={previewLoading}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-orange-600"
                        >
                          <Eye size={16} />
                          {previewLoading ? "..." : "Ver"}
                        </button>
                      )}
                      <button
                        onClick={() => downloadFileBlob(doc.id, file.id, `${file.kind}.${ext}`)}
                        className="inline-flex items-center gap-1.5 text-sm text-orange-600 transition-colors hover:text-orange-700"
                      >
                        <Download size={16} /> Baixar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {previewableFile && signatories.length === 0 && (
            <button
              onClick={() => handlePreviewPdf(previewableFile.id)}
              disabled={previewLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-4 text-sm text-gray-500 transition-colors hover:border-orange-400 hover:text-orange-600"
            >
              <Eye size={16} />
              {previewLoading ? "Carregando PDF..." : "Pre-visualizar documento"}
            </button>
          )}

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Dados preenchidos</h2>
            </div>
            <div className="p-6">
              {Object.keys(doc.field_data ?? {}).length === 0 ? (
                <p className="text-sm text-gray-400">
                  Este documento nao tem metadados de template salvos. Isso e esperado em PDFs
                  manuais.
                </p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(doc.field_data).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase text-gray-400">{key}</dt>
                      <dd className="mt-0.5 text-sm text-gray-700">{renderFieldValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <LayoutTemplate size={16} className="text-orange-600" />
              Resumo
            </h2>
            <div className="mt-4 grid gap-3">
              <MetaRow label="Origem" value={sourceLabel} />
              <MetaRow label="Modelo" value={doc.template_name ?? "Nao associado"} />
              <MetaRow label="Assinaturas" value={`${doc.signed_signatories_count}/${doc.signatories_count}`} />
              <MetaRow label="Pendencias" value={String(doc.pending_signatories_count)} />
              <MetaRow label="Codigo de verificacao" value={doc.verification_code} />
              <MetaRow
                label="Ultima atividade"
                value={
                  doc.last_activity_at
                    ? new Date(doc.last_activity_at).toLocaleString("pt-BR")
                    : "Sem atividade"
                }
              />
            </div>

            <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
              <div className="text-sm font-medium text-orange-900">Validacao publica</div>
              <div className="mt-1 text-xs text-orange-700 break-all">{verificationUrl}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
                >
                  <ExternalLink size={14} />
                  Abrir pagina
                </a>
                <button
                  type="button"
                  onClick={copyVerificationLink}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
                >
                  <Copy size={14} />
                  {verificationCopied ? "Link copiado" : "Copiar link"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Checklist de preparo</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <ChecklistItem checked={signatories.length > 0}>Signatarios cadastrados</ChecklistItem>
              <ChecklistItem checked={fields.length > 0 || signatories.length === 0}>
                Campos posicionados ou fluxo sem campos
              </ChecklistItem>
              <ChecklistItem checked={doc.status !== "generated"}>Documento enviado</ChecklistItem>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Clock size={16} className="text-orange-600" /> Auditoria
                </h2>
                <span className="text-xs text-gray-400">{filteredAuditLogs.length} evento(s)</span>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(event) => setAuditSearch(event.target.value)}
                    placeholder="Buscar em eventos, IP, ator ou detalhes"
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "Tudo" },
                    { value: "document", label: "Documento" },
                    { value: "signatory", label: "Signatarios" },
                    { value: "field", label: "Campos" },
                    { value: "signature", label: "Assinatura" },
                    { value: "otp", label: "OTP" },
                    { value: "identity", label: "Identidade" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAuditFilter(option.value)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        auditFilter === option.value
                          ? "bg-orange-50 text-orange-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Filter size={12} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6">
              {!filteredAuditLogs.length ? (
                <p className="text-sm text-gray-400">Nenhum evento corresponde ao filtro atual.</p>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gray-200" />
                  <div className="space-y-5">
                    {filteredAuditLogs.map((log) => (
                      <div key={log.id} className="relative pl-7">
                        <div
                          className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-white ${
                            actionColors[log.action] ?? "bg-gray-400"
                          }`}
                        />
                        <div>
                          <div className="text-sm text-gray-900">{actionLabels[log.action] ?? log.action}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                log.chain_ok === false
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {log.chain_ok === false ? "Cadeia com divergencia" : "Cadeia verificada"}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">
                              {log.entry_hash.slice(0, 12)}...
                            </span>
                          </div>
                          {log.actor_label && (
                            <div className="mt-0.5 text-xs text-gray-500">Ator: {log.actor_label}</div>
                          )}
                          {log.ip_address && (
                            <div className="mt-0.5 text-xs text-gray-500">IP: {log.ip_address}</div>
                          )}
                          {log.user_agent && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                              Dispositivo: {log.user_agent}
                            </div>
                          )}
                          {log.details &&
                            Object.entries(log.details).map(([key, value]) => (
                              <div key={key} className="mt-0.5 text-xs text-gray-500">
                                {key}: {String(value)}
                              </div>
                            ))}
                          <div className="mt-1 text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function PdfReplacementCard({
  title,
  onTitleChange,
  file,
  onFileChange,
  onSubmit,
  busy,
  error,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
          <Upload size={18} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Substituir PDF do rascunho</h2>
          <p className="mt-1 text-sm text-gray-500">
            Use isso quando o documento precisar vir de um PDF externo ou de uma versao revisada.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Titulo do documento</span>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </label>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Arquivo PDF</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 transition-colors hover:border-orange-500">
            <Upload size={20} className="shrink-0 text-gray-400" />
            <span className="truncate text-sm text-gray-500">
              {file ? file.name : "Clique para selecionar um PDF"}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A substituicao remove os campos posicionados para que eles sejam definidos novamente sobre o
          novo PDF.
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            {busy ? "Substituindo..." : "Salvar novo PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  checked,
  children,
}: {
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
          checked ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
        }`}
      >
        <Check size={12} />
      </span>
      <span>{children}</span>
    </div>
  );
}

function ReadonlySignatories({
  signatories,
  copiedId,
  resentId,
  onCopy,
  onResend,
}: {
  signatories: SignatoryInfo[];
  copiedId: string | null;
  resentId: string | null;
  onCopy: (token: string, signatoryId: string) => void;
  onResend: (signatoryId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Signatarios</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {signatories.map((signatory) => {
          const cfg = sigStatusConfig[signatory.status] ?? sigStatusConfig.pending;
          const StatusIcon = cfg.icon;
          const canResend = !["signed", "refused"].includes(signatory.status);
          const signingUrl = `${window.location.origin}/sign/${signatory.token}`;

          return (
            <div key={signatory.id} className="px-6 py-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusIcon size={18} className={cfg.color} />
                  <div>
                    <div className="text-sm text-gray-900">
                      {signatory.name}
                      {signatory.role_label && (
                        <span className="ml-2 text-xs text-gray-400">{signatory.role_label}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{signatory.email}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                  {signatory.signed_at && (
                    <div className="text-xs text-gray-400">
                      {new Date(signatory.signed_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {signatory.signing_order ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                    Ordem {signatory.signing_order}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    Ordem livre
                  </span>
                )}

                {signatory.auth_require_email_otp && (
                  <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] text-orange-700">
                    OTP por email
                  </span>
                )}

                {signatory.auth_require_cpf && (
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">
                    CPF obrigatorio
                  </span>
                )}
              </div>

              {canResend && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <ExternalLink size={13} className="shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-500">{signingUrl}</span>
                  <button
                    onClick={() => onCopy(signatory.token, signatory.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-orange-600"
                    title="Copiar link"
                  >
                    {copiedId === signatory.id ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <Check size={13} /> Copiado
                      </span>
                    ) : (
                      <>
                        <Copy size={13} /> Copiar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => void onResend(signatory.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-orange-600"
                    title="Reenviar por email"
                  >
                    {resentId === signatory.id ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <Check size={13} /> Enviado
                      </span>
                    ) : (
                      <>
                        <RefreshCw size={13} /> Reenviar email
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

