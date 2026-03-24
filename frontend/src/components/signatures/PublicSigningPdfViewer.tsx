import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { PenTool, ScanText, Type } from "lucide-react";
import {
  getSigningPdfUrl,
  type PublicSignatureFieldInfo,
} from "../../services/signatures";
import "../../lib/pdf";

interface PublicSigningPdfViewerProps {
  token: string;
  signatoryName: string;
  fields: PublicSignatureFieldInfo[];
  values: Record<string, string>;
  onFieldValueChange: (fieldId: string, value: string) => void;
  typedName: string;
  signatureMode: "drawn" | "typed";
  signatureImage: string;
  editableTextFields?: boolean;
  showSignaturePreview?: boolean;
}

const FIELD_STYLES: Record<
  PublicSignatureFieldInfo["field_type"],
  {
    border: string;
    background: string;
    text: string;
    tag: string;
    title: string;
  }
> = {
  signature: {
    border: "border-orange-400",
    background: "bg-orange-50/90",
    text: "text-orange-700",
    tag: "bg-orange-500 text-white",
    title: "Assinatura",
  },
  initials: {
    border: "border-amber-400",
    background: "bg-amber-50/90",
    text: "text-amber-700",
    tag: "bg-amber-500 text-white",
    title: "Visto",
  },
  text: {
    border: "border-emerald-400",
    background: "bg-white/95",
    text: "text-emerald-700",
    tag: "bg-emerald-600 text-white",
    title: "Texto",
  },
};

export default function PublicSigningPdfViewer({
  token,
  signatoryName,
  fields,
  values,
  onFieldValueChange,
  typedName,
  signatureMode,
  signatureImage,
  editableTextFields = false,
  showSignaturePreview = false,
}: PublicSigningPdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(720);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const nextWidth = Math.max(260, Math.min(node.clientWidth - 16, 900));
      setPageWidth(nextWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const displayName = typedName.trim() || signatoryName;
  const initials = getInitials(displayName);
  const normalizedSignatureImage = normalizeSignatureImage(signatureImage);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Documento para assinatura</h3>
            <p className="text-xs text-gray-500 mt-1">
              Os campos aparecem exatamente na posicao em que serao aplicados no PDF final.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
              <PenTool size={12} />
              Assinatura
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
              <Type size={12} />
              Visto
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <ScanText size={12} />
              Texto
            </span>
          </div>
        </div>
      </div>

      <div ref={viewerRef} className="bg-gray-100 p-3 sm:p-5 overflow-auto">
        <Document
          file={getSigningPdfUrl(token)}
          onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
          loading={<PdfMessage message="Carregando PDF..." />}
          error={<PdfMessage message="Nao foi possivel carregar o PDF." tone="error" />}
          noData={<PdfMessage message="Nenhum PDF disponivel." tone="error" />}
        >
          <div className="space-y-6">
            {Array.from({ length: numPages }, (_, index) => index + 1).map((pageNumber) => (
              <div key={pageNumber} className="mx-auto w-fit">
                <div className="mb-2 px-1 text-xs font-medium text-gray-500">Pagina {pageNumber}</div>
                <div className="relative inline-block rounded-2xl overflow-hidden shadow-xl bg-white">
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />

                  <div className="absolute inset-0">
                    {fields
                      .filter((field) => field.page === pageNumber)
                      .map((field) => {
                        const style = FIELD_STYLES[field.field_type];
                        const value = values[field.id] ?? field.value ?? "";

                        return (
                          <div
                            key={field.id}
                            className={`absolute rounded-xl border-2 shadow-sm ${style.border} ${style.background}`}
                            style={{
                              left: `${field.x * 100}%`,
                              top: `${field.y * 100}%`,
                              width: `${field.width * 100}%`,
                              height: `${field.height * 100}%`,
                            }}
                          >
                            <div
                              className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold ${style.tag}`}
                            >
                              {style.title}
                              {field.label ? ` / ${field.label}` : ""}
                              {field.required ? " *" : ""}
                            </div>

                            <div className="flex h-full w-full items-center justify-center px-2 pb-2 pt-7">
                              {field.field_type === "text" ? (
                                <input
                                  type="text"
                                  value={value}
                                  disabled={!editableTextFields}
                                  onChange={(event) =>
                                    onFieldValueChange(field.id, event.target.value)
                                  }
                                  placeholder={field.label || "Digite aqui"}
                                  className="h-full min-h-[34px] w-full rounded-lg border border-emerald-300 bg-white/95 px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm"
                                />
                              ) : field.field_type === "signature" ? (
                                <SignaturePreview
                                  signatureMode={signatureMode}
                                  signatureImage={normalizedSignatureImage}
                                  typedName={displayName}
                                  showPreview={showSignaturePreview}
                                  textColor={style.text}
                                />
                              ) : (
                                <InitialsPreview
                                  initials={initials}
                                  showPreview={showSignaturePreview}
                                  textColor={style.text}
                                />
                              )}
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
    </div>
  );
}

function SignaturePreview({
  signatureMode,
  signatureImage,
  typedName,
  showPreview,
  textColor,
}: {
  signatureMode: "drawn" | "typed";
  signatureImage: string;
  typedName: string;
  showPreview: boolean;
  textColor: string;
}) {
  if (showPreview && signatureMode === "drawn" && signatureImage) {
    return (
      <img
        src={signatureImage}
        alt="Previa da assinatura"
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  if (showPreview && typedName.trim()) {
    return (
      <div
        className={`w-full text-center text-lg sm:text-2xl ${textColor}`}
        style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
      >
        {typedName}
      </div>
    );
  }

  return (
    <div className={`text-center text-xs font-medium ${textColor}`}>
      A previa da assinatura aparecera aqui
    </div>
  );
}

function InitialsPreview({
  initials,
  showPreview,
  textColor,
}: {
  initials: string;
  showPreview: boolean;
  textColor: string;
}) {
  if (showPreview && initials) {
    return <div className={`text-lg font-bold sm:text-2xl ${textColor}`}>{initials}</div>;
  }

  return <div className={`text-center text-xs font-medium ${textColor}`}>O visto aparecera aqui</div>;
}

function PdfMessage({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-6 text-center text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-gray-200 bg-white text-gray-500"
      }`}
    >
      {message}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function normalizeSignatureImage(value: string): string {
  if (!value) {
    return "";
  }

  if (value.startsWith("data:image")) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

