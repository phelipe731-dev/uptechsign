import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useDocument } from "../../hooks/useDocuments";
import { getSignatureFields, getSignatories, sendForSigning } from "../../services/signatures";
import DocumentUploadStep from "./DocumentUploadStep";
import SignatoriesStep from "./SignatoriesStep";
import AuthenticationOptions from "./AuthenticationOptions";
import SignaturePositionStep from "./SignaturePositionStep";
import SendDocumentStep from "./SendDocumentStep";

const STEPS = [
  { id: 1, title: "Documento" },
  { id: 2, title: "Signatarios" },
  { id: 3, title: "Autenticacao" },
  { id: 4, title: "Campos" },
  { id: 5, title: "Enviar" },
] as const;

export default function DocumentWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data: document } = useDocument(documentId ?? undefined);

  const { data: signatories = [] } = useQuery({
    queryKey: ["signatories", documentId],
    queryFn: () => getSignatories(documentId!),
    enabled: !!documentId,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["signature-fields", documentId],
    queryFn: () => getSignatureFields(documentId!),
    enabled: !!documentId,
  });

  function invalidateWizardQueries() {
    queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    queryClient.invalidateQueries({ queryKey: ["signatories", documentId] });
    queryClient.invalidateQueries({ queryKey: ["signature-fields", documentId] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  async function handleSend() {
    if (!documentId) return;
    setSending(true);
    setSendError(null);
    try {
      await sendForSigning(documentId, []);
      invalidateWizardQueries();
      navigate(`/documents/${documentId}`);
    } catch (err: unknown) {
      setSendError(extractApiError(err));
    } finally {
      setSending(false);
    }
  }

  const generatedPdfFile = document?.files.find((file) => file.kind === "generated_pdf");
  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!documentId;
      case 2:
        return signatories.length > 0;
      case 3:
        return signatories.length > 0;
      case 4:
        return signatories.length > 0;
      default:
        return false;
    }
  }, [currentStep, documentId, signatories.length]);

  const maxReachableStep = useMemo(() => {
    if (!documentId) return 1;
    if (signatories.length === 0) return 2;
    return 5;
  }, [documentId, signatories.length]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Documento</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fluxo guiado para gerar, configurar e enviar o documento para assinatura.
          </p>
        </div>

        {document && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 min-w-[240px]">
            <div className="font-medium text-gray-900">{document.title}</div>
            <div className="mt-1">Status atual: {document.status}</div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-5">
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isAvailable = step.id <= maxReachableStep;

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => setCurrentStep(step.id)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-orange-500 bg-orange-50"
                    : isAvailable
                      ? "border-gray-200 hover:border-gray-300 bg-white"
                      : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                }`}
              >
                <div className="text-xs text-gray-400">Etapa {step.id}</div>
                <div className={`mt-1 text-sm font-medium ${isActive ? "text-orange-700" : "text-gray-800"}`}>
                  {step.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {currentStep === 1 && (
        <DocumentUploadStep
          documentId={documentId}
          documentTitle={document?.title}
          documentSourceType={document?.source_type}
          onCreated={(id) => {
            setDocumentId(id);
            setCurrentStep(2);
          }}
          onUpdated={invalidateWizardQueries}
        />
      )}

      {currentStep === 2 && documentId && (
        <SignatoriesStep documentId={documentId} signatories={signatories} onChanged={invalidateWizardQueries} />
      )}

      {currentStep === 3 && documentId && (
        <AuthenticationOptions signatories={signatories} onChanged={invalidateWizardQueries} />
      )}

      {currentStep === 4 && documentId && generatedPdfFile && (
        <SignaturePositionStep
          documentId={documentId}
          pdfFileId={generatedPdfFile.id}
          signatories={signatories}
          fields={fields}
          onChanged={invalidateWizardQueries}
        />
      )}

      {currentStep === 4 && documentId && !generatedPdfFile && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
          Nao foi possivel localizar o PDF gerado para posicionar os campos.
        </div>
      )}

      {currentStep === 5 && document && (
        <SendDocumentStep
          document={document}
          signatories={signatories}
          fields={fields}
          sending={sending}
          error={sendError}
          onSend={handleSend}
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
          disabled={currentStep === 1}
          className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.min(5, step + 1))}
            disabled={!canAdvance}
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            Proxima etapa
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(documentId ? `/documents/${documentId}` : "/documents")}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText size={16} />
            Abrir detalhe
          </button>
        )}
      </div>
    </div>
  );
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

