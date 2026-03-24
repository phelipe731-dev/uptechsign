import { useMemo, useState } from "react";
import { CheckCircle2, FileText, RefreshCw, Upload } from "lucide-react";
import { useTemplates, useCreateDocument } from "../../hooks/useDocuments";
import {
  replaceDocumentPdf,
  uploadPdfDocument,
} from "../../services/documents";
import type { Template } from "../../types";

interface DocumentUploadStepProps {
  documentId: string | null;
  documentTitle?: string;
  documentSourceType?: "template" | "manual";
  onCreated: (documentId: string) => void;
  onUpdated: () => void;
}

type CreationMode = "template" | "manual";

export default function DocumentUploadStep({
  documentId,
  documentTitle,
  documentSourceType = "template",
  onCreated,
  onUpdated,
}: DocumentUploadStepProps) {
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const createDocument = useCreateDocument();
  const [mode, setMode] = useState<CreationMode>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState("");
  const [fieldData, setFieldData] = useState<Record<string, string>>({});
  const [manualTitle, setManualTitle] = useState(documentTitle ?? "");
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplaceForm, setShowReplaceForm] = useState(false);

  const sortedFields = useMemo(
    () =>
      selectedTemplate
        ? [...selectedTemplate.fields].sort((a, b) => a.display_order - b.display_order)
        : [],
    [selectedTemplate]
  );

  function handleTemplateSelect(templateId: string) {
    const template = templates?.find((item) => item.id === templateId) ?? null;
    setSelectedTemplate(template);
    setTitle("");
    setFieldData({});
    setError(null);
  }

  function handleFieldChange(key: string, value: string) {
    setFieldData((current) => ({ ...current, [key]: value }));
  }

  async function handleTemplateSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTemplate) return;

    setError(null);

    try {
      const document = await createDocument.mutateAsync({
        template_id: selectedTemplate.id,
        title: title || `${selectedTemplate.name} - ${fieldData["nome_menor"] || "Sem nome"}`,
        field_data: fieldData,
      });
      onCreated(document.id);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  }

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!manualFile) {
      setError("Selecione um arquivo PDF para continuar.");
      return;
    }

    setManualBusy(true);
    setError(null);

    try {
      if (documentId) {
        await replaceDocumentPdf(documentId, manualFile, manualTitle.trim() || undefined);
        setShowReplaceForm(false);
        setManualFile(null);
        onUpdated();
        return;
      }

      const document = await uploadPdfDocument(
        manualFile,
        manualTitle.trim() || manualFile.name.replace(/\.pdf$/i, "")
      );
      onCreated(document.id);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setManualBusy(false);
    }
  }

  if (documentId) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-gray-900">Documento pronto para a configuracao</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  documentSourceType === "manual"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-orange-50 text-orange-700"
                }`}
              >
                {documentSourceType === "manual" ? "PDF manual" : "Template DOCX"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              O documento ja existe no rascunho e pode seguir para signatarios, autenticacao e
              campos.
            </p>
            <div className="mt-3 text-sm text-gray-700">
              <span className="font-medium">Titulo:</span> {documentTitle || "Documento em rascunho"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Se quiser, voce pode substituir o PDF agora. Isso preserva os signatarios do rascunho, mas
          remove os campos posicionados para evitar coordenadas inconsistentes.
        </div>

        {!showReplaceForm ? (
          <button
            type="button"
            onClick={() => {
              setShowReplaceForm(true);
              setMode("manual");
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} />
            Substituir por outro PDF
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4 border-t border-gray-100 pt-5">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Titulo do documento</span>
              <input
                type="text"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Novo titulo para o PDF"
              />
            </label>

            <PdfPicker file={manualFile} onChange={setManualFile} />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={manualBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {manualBusy ? "Substituindo..." : "Salvar novo PDF"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReplaceForm(false);
                  setManualFile(null);
                  setError(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-gray-900">1. Selecionar documento</h3>
        <p className="text-sm text-gray-500 mt-1">
          Gere um PDF a partir de um template ou envie um PDF pronto para seguir com a assinatura.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("template");
            setError(null);
          }}
          className={`rounded-xl border p-4 text-left transition-colors ${
            mode === "template"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-2 text-orange-600 shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Gerar via template</div>
              <div className="text-xs text-gray-500 mt-1">
                Preenche os campos do DOCX e cria o PDF automaticamente.
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("manual");
            setError(null);
          }}
          className={`rounded-xl border p-4 text-left transition-colors ${
            mode === "manual"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-2 text-amber-600 shadow-sm">
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Enviar PDF manual</div>
              <div className="text-xs text-gray-500 mt-1">
                Comeca com um PDF pronto e segue direto para os signatarios.
              </div>
            </div>
          </div>
        </button>
      </div>

      {mode === "template" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Modelo de documento</label>
            {templatesLoading ? (
              <div className="text-gray-400 text-sm">Carregando modelos...</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {templates?.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                      selectedTemplate?.id === template.id
                        ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <FileText
                      size={22}
                      className={selectedTemplate?.id === template.id ? "text-orange-600" : "text-gray-400"}
                    />
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          selectedTemplate?.id === template.id ? "text-orange-700" : "text-gray-900"
                        }`}
                      >
                        {template.name}
                      </div>
                      {template.description && (
                        <div className="mt-0.5 text-xs text-gray-400">{template.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTemplate && (
            <form onSubmit={handleTemplateSubmit} className="space-y-5">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">
                  Titulo do documento (opcional)
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder={`${selectedTemplate.name} - Nome do cliente`}
                />
              </label>

              <div className="border-t border-gray-100 pt-5">
                <h4 className="mb-4 text-sm font-semibold text-gray-900">Dados do documento</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sortedFields.map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.key === "endereco" || field.key === "nome_menor" || field.key === "nome_rep"
                          ? "sm:col-span-2"
                          : ""
                      }
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {field.display_label || field.label}
                        {field.required && <span className="ml-1 text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={fieldData[field.key] ?? ""}
                        onChange={(event) => handleFieldChange(field.key, event.target.value)}
                        required={field.required}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createDocument.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <FileText size={16} />
                  {createDocument.isPending ? "Gerando..." : "Gerar documento"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Titulo do documento</span>
            <input
              type="text"
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Ex: Contrato de honorarios - Maria Silva"
            />
          </label>

          <PdfPicker file={manualFile} onChange={setManualFile} />

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            O PDF sera salvo como rascunho e podera receber signatarios, campos e envio logo em
            seguida.
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={manualBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <Upload size={16} />
              {manualBusy ? "Enviando..." : "Enviar PDF e continuar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function PdfPicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Arquivo PDF</label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 transition-colors hover:border-orange-500">
        <Upload size={20} className="shrink-0 text-gray-400" />
        <span className="truncate text-sm text-gray-500">
          {file ? file.name : "Clique para selecionar um PDF"}
        </span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
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


