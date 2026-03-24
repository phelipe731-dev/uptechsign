import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { Grip, Move, Trash2 } from "lucide-react";
import type { SignatureField } from "../../types";
import type { SignatoryInfo } from "../../services/signatures";
import {
  createSignatureField,
  deleteSignatureField,
  updateSignatureField,
} from "../../services/signatures";
import api from "../../services/api";
import "../../lib/pdf";

interface SignatureFieldEditorProps {
  documentId: string;
  pdfFileId: string;
  signatories: SignatoryInfo[];
  fields: SignatureField[];
  disabled?: boolean;
  onChanged: () => void;
}

const DEFAULT_SIZES: Record<SignatureField["field_type"], { width: number; height: number }> = {
  signature: { width: 0.28, height: 0.09 },
  initials: { width: 0.12, height: 0.06 },
  text: { width: 0.24, height: 0.06 },
};

const FIELD_STYLES: Record<
  SignatureField["field_type"],
  { outline: string; bg: string; label: string }
> = {
  signature: {
    outline: "border-orange-500",
    bg: "bg-orange-100/80",
    label: "Assinatura",
  },
  initials: {
    outline: "border-amber-500",
    bg: "bg-amber-100/80",
    label: "Visto",
  },
  text: {
    outline: "border-emerald-500",
    bg: "bg-emerald-100/80",
    label: "Texto",
  },
};

type InteractionState = {
  fieldId: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  originField: SignatureField;
};

export default function SignatureFieldEditor({
  documentId,
  pdfFileId,
  signatories,
  fields,
  disabled = false,
  onChanged,
}: SignatureFieldEditorProps) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [selectedSignatoryId, setSelectedSignatoryId] = useState("");
  const [fieldType, setFieldType] = useState<SignatureField["field_type"]>("signature");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldRequired, setFieldRequired] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, Partial<SignatureField>>>({});
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [busyFieldId, setBusyFieldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedSignatoryId && signatories.length > 0) {
      setSelectedSignatoryId(signatories[0].id);
    }
  }, [selectedSignatoryId, signatories]);

  useEffect(() => {
    async function loadPdf() {
      setPdfLoading(true);
      try {
        const response = await api.get(`/documents/${documentId}/files/${pdfFileId}/download`, {
          responseType: "arraybuffer",
        });
        setPdfData(new Uint8Array((response.data as ArrayBuffer).slice(0)));
        setError(null);
      } catch (err: unknown) {
        setPdfData(null);
        setError(extractApiError(err));
      } finally {
        setPdfLoading(false);
      }
    }

    setPdfData(null);
    setPdfLoading(true);
    setNumPages(0);
    setError(null);
    void loadPdf();
  }, [documentId, pdfFileId]);

  useEffect(() => {
    if (!selectedFieldId) return;
    if (!fields.some((field) => field.id === selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [fields, selectedFieldId]);

  useEffect(() => {
    if (!interaction) return;
    const interactionState = interaction;

    function handlePointerMove(event: PointerEvent) {
      const pageElement = pageRefs.current[interactionState.originField.page];
      if (!pageElement) return;

      const rect = pageElement.getBoundingClientRect();
      const deltaX = (event.clientX - interactionState.startX) / rect.width;
      const deltaY = (event.clientY - interactionState.startY) / rect.height;

      if (interactionState.mode === "move") {
        setFieldDrafts((current) => ({
          ...current,
          [interactionState.fieldId]: {
            x: clamp(interactionState.originField.x + deltaX, 0, 1 - interactionState.originField.width),
            y: clamp(interactionState.originField.y + deltaY, 0, 1 - interactionState.originField.height),
          },
        }));
        return;
      }

      setFieldDrafts((current) => ({
        ...current,
        [interactionState.fieldId]: {
          width: clamp(interactionState.originField.width + deltaX, 0.05, 1 - interactionState.originField.x),
          height: clamp(interactionState.originField.height + deltaY, 0.035, 1 - interactionState.originField.y),
        },
      }));
    }

    async function handlePointerUp() {
      const draft = fieldDrafts[interactionState.fieldId];
      setInteraction(null);
      if (!draft) return;

      setBusyFieldId(interactionState.fieldId);
      setError(null);
      try {
        await updateSignatureField(interactionState.fieldId, draft);
        setFieldDrafts((current) => {
          const next = { ...current };
          delete next[interactionState.fieldId];
          return next;
        });
        onChanged();
      } catch (err: unknown) {
        setError(extractApiError(err));
      } finally {
        setBusyFieldId(null);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [fieldDrafts, interaction, onChanged]);

  const mergedFields = useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        ...fieldDrafts[field.id],
      })),
    [fieldDrafts, fields]
  );
  const pdfFile = useMemo(() => {
    if (!pdfData) return null;
    return { data: pdfData.slice(0) };
  }, [pdfData]);

  const selectedField = mergedFields.find((field) => field.id === selectedFieldId) ?? null;

  async function handleCreateField(page: number, event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !selectedSignatoryId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const size = DEFAULT_SIZES[fieldType];
    const nextX = clamp((event.clientX - rect.left) / rect.width - size.width / 2, 0, 1 - size.width);
    const nextY = clamp((event.clientY - rect.top) / rect.height - size.height / 2, 0, 1 - size.height);

    setError(null);
    try {
      const createdField = await createSignatureField(documentId, {
        signatory_id: selectedSignatoryId,
        page,
        field_type: fieldType,
        label: fieldLabel || undefined,
        x: nextX,
        y: nextY,
        width: size.width,
        height: size.height,
        required: fieldRequired,
      });
      setSelectedFieldId(createdField.id);
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  }

  async function handleUpdateField(fieldId: string, patch: Partial<SignatureField>) {
    setBusyFieldId(fieldId);
    setError(null);
    try {
      await updateSignatureField(fieldId, patch);
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setBusyFieldId(null);
    }
  }

  async function handleDeleteField(fieldId: string) {
    setBusyFieldId(fieldId);
    setError(null);
    try {
      await deleteSignatureField(fieldId);
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setBusyFieldId(null);
    }
  }

  function handleStartInteraction(
    event: React.PointerEvent<HTMLDivElement>,
    field: SignatureField,
    mode: "move" | "resize"
  ) {
    event.stopPropagation();
    if (disabled) return;
    setSelectedFieldId(field.id);
    setInteraction({
      fieldId: field.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originField: field,
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Campos no PDF</h2>
          <p className="text-sm text-gray-500 mt-1">
            Clique na pagina para inserir um campo. Depois arraste para mover e use o canto inferior
            direito para redimensionar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Signatario</span>
            <select
              value={selectedSignatoryId}
              onChange={(e) => setSelectedSignatoryId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
            >
              <option value="">Selecione</option>
              {signatories.map((signatory) => (
                <option key={signatory.id} value={signatory.id}>
                  {signatory.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Tipo do campo</span>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as SignatureField["field_type"])}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
            >
              <option value="signature">Assinatura</option>
              <option value="initials">Visto</option>
              <option value="text">Texto</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-xs text-gray-600 mb-1">Rotulo do campo</span>
            <input
              type="text"
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              placeholder="Ex: Data da assinatura"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={fieldRequired}
              onChange={(e) => setFieldRequired(e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            Campo obrigatorio
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedField && (
        <div className="border border-orange-200 bg-orange-50/60 rounded-xl p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block flex-1">
              <span className="block text-xs text-gray-600 mb-1">Rotulo</span>
              <input
                type="text"
                value={selectedField.label ?? ""}
                onChange={(e) =>
                  void handleUpdateField(selectedField.id, {
                    label: e.target.value || null,
                  })
                }
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
              />
            </label>

            <label className="block min-w-[180px]">
              <span className="block text-xs text-gray-600 mb-1">Signatario</span>
              <select
                value={selectedField.signatory_id}
                onChange={(e) =>
                  void handleUpdateField(selectedField.id, { signatory_id: e.target.value })
                }
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
              >
                {signatories.map((signatory) => (
                  <option key={signatory.id} value={signatory.id}>
                    {signatory.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-[160px]">
              <span className="block text-xs text-gray-600 mb-1">Tipo</span>
              <select
                value={selectedField.field_type}
                onChange={(e) =>
                  void handleUpdateField(selectedField.id, {
                    field_type: e.target.value as SignatureField["field_type"],
                  })
                }
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
              >
                <option value="signature">Assinatura</option>
                <option value="initials">Visto</option>
                <option value="text">Texto</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700 min-w-[160px] pb-2">
              <input
                type="checkbox"
                checked={selectedField.required}
                onChange={(e) =>
                  void handleUpdateField(selectedField.id, {
                    required: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              Campo obrigatorio
            </label>

            <button
              type="button"
              onClick={() => void handleDeleteField(selectedField.id)}
              disabled={busyFieldId === selectedField.id}
              className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              Excluir
            </button>
          </div>
        </div>
      )}

      {pdfLoading ? (
        <div className="text-sm text-gray-500">Carregando PDF...</div>
      ) : !pdfFile ? (
        <div className="text-sm text-gray-500">Nenhum PDF disponivel para visualizacao.</div>
      ) : (
        <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 overflow-auto">
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
            loading={<div className="text-sm text-gray-500">Carregando PDF...</div>}
            error={<div className="text-sm text-red-700">Nao foi possivel abrir o PDF.</div>}
            noData={<div className="text-sm text-gray-500">Nenhum PDF disponivel.</div>}
            onLoadError={(loadError) => {
              setError(
                loadError instanceof Error && loadError.message
                  ? `Nao foi possivel abrir o PDF: ${loadError.message}`
                  : "Nao foi possivel abrir o PDF."
              );
            }}
            onSourceError={(sourceError) => {
              setError(
                sourceError instanceof Error && sourceError.message
                  ? `Erro ao carregar o arquivo PDF: ${sourceError.message}`
                  : "Erro ao carregar o arquivo PDF."
              );
            }}
          >
            <div className="space-y-6">
              {Array.from({ length: numPages }, (_, index) => index + 1).map((pageNumber) => (
                <div key={pageNumber}>
                  <div className="text-xs text-gray-500 mb-2">Pagina {pageNumber}</div>
                  <div
                    ref={(node) => {
                      pageRefs.current[pageNumber] = node;
                    }}
                    className="relative inline-block shadow-lg bg-white"
                    onClick={(event) => void handleCreateField(pageNumber, event)}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={760}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />

                    <div className="absolute inset-0">
                      {mergedFields
                        .filter((field) => field.page === pageNumber)
                        .map((field) => {
                          const style = FIELD_STYLES[field.field_type];
                          const signatoryName =
                            signatories.find((signatory) => signatory.id === field.signatory_id)?.name ??
                            "Sem signatario";

                          return (
                            <div
                              key={field.id}
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedFieldId(field.id);
                              }}
                              onPointerDown={(event) => handleStartInteraction(event, field, "move")}
                              className={`absolute rounded border-2 ${style.outline} ${style.bg} ${
                                selectedFieldId === field.id ? "ring-2 ring-offset-1 ring-orange-400" : ""
                              } ${busyFieldId === field.id ? "opacity-70" : ""}`}
                              style={{
                                left: `${field.x * 100}%`,
                                top: `${field.y * 100}%`,
                                width: `${field.width * 100}%`,
                                height: `${field.height * 100}%`,
                              }}
                            >
                              <div className="absolute inset-0 flex flex-col justify-between p-1 pointer-events-none">
                                <div className="text-[10px] font-medium text-gray-700 truncate">
                                  {style.label}
                                  {field.label ? ` â€¢ ${field.label}` : ""}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">{signatoryName}</div>
                              </div>

                              <button
                                type="button"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDeleteField(field.id);
                                }}
                                disabled={disabled || busyFieldId === field.id}
                                className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Excluir campo"
                                aria-label={`Excluir campo ${field.label ?? style.label}`}
                              >
                                <Trash2 size={11} />
                              </button>

                              <div className="absolute top-1 right-7 bg-white/80 rounded px-1 py-0.5 text-[10px] text-gray-500 pointer-events-none">
                                <Move size={10} />
                              </div>

                              <div
                                onPointerDown={(event) => handleStartInteraction(event, field, "resize")}
                                className="absolute -bottom-1 -right-1 h-4 w-4 rounded bg-white border border-gray-400 flex items-center justify-center cursor-se-resize"
                              >
                                <Grip size={10} className="text-gray-500" />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Document>
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

