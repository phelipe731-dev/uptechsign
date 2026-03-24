import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import {
  getTemplates,
  uploadTemplate,
  updateTemplateFields,
  detectTemplateFields,
  deactivateTemplate,
  replaceTemplateFile,
} from "../services/documents";
import FieldMapper from "../components/templates/FieldMapper";
import type { Template, TemplateField } from "../types";

export default function Templates() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () => uploadTemplate(uploadFile!, uploadName, uploadDesc),
    onSuccess: (tpl) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setShowUpload(false);
      setUploadFile(null);
      setUploadName("");
      setUploadDesc("");
      setUploadError(null);
      // Auto-open editor for newly uploaded template
      setEditingId(tpl.id);
      setEditFields([...tpl.fields]);
      setEditName(tpl.name);
      setEditDesc(tpl.description || "");
    },
    onError: (err) => setUploadError(extractError(err)),
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFields, setEditFields] = useState<TemplateField[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacingFile, setReplacingFile] = useState(false);

  function openEditor(tpl: Template) {
    setEditingId(tpl.id);
    setEditName(tpl.name);
    setEditDesc(tpl.description || "");
    setEditFields([...tpl.fields]);
    setEditError(null);
    setEditSuccess(false);
    setReplacementFile(null);
  }

  function closeEditor() {
    setEditingId(null);
    setEditError(null);
    setEditSuccess(false);
    setReplacementFile(null);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTemplateFields(editingId!, editName, editDesc, editFields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setEditSuccess(true);
      setEditError(null);
      setTimeout(() => setEditSuccess(false), 2500);
    },
    onError: (err) => {
      setEditError(extractError(err));
      setEditSuccess(false);
    },
  });

  async function handleRedetect() {
    if (!editingId) return;
    setRedetecting(true);
    try {
      const res = await detectTemplateFields(editingId);
      const newFields: TemplateField[] = res.detected.map((d) => ({
        key: d.suggested_key,
        label: d.label,
        required: false,
        display_order: d.display_order,
      }));
      setEditFields(newFields);
    } catch (err) {
      setEditError(extractError(err));
    } finally {
      setRedetecting(false);
    }
  }

  async function handleReplaceTemplateDocx() {
    if (!editingId || !replacementFile) return;
    setReplacingFile(true);
    setEditError(null);
    try {
      const tpl = await replaceTemplateFile(editingId, replacementFile);
      qc.invalidateQueries({ queryKey: ["templates"] });
      setEditFields([...tpl.fields]);
      setEditSuccess(true);
      setReplacementFile(null);
      setTimeout(() => setEditSuccess(false), 2500);
    } catch (err) {
      setEditError(extractError(err));
      setEditSuccess(false);
    } finally {
      setReplacingFile(false);
    }
  }

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deactivateTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  // Expanded rows (show field list inline)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Modelos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie os modelos DOCX usados para gerar documentos
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors text-sm"
        >
          <Upload size={16} />
          Novo Modelo
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Novo Modelo</h3>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome do modelo *
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Ex: Contrato de PrestaÃ§Ã£o de ServiÃ§os"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  DescriÃ§Ã£o
                </label>
                <input
                  type="text"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Breve descriÃ§Ã£o (opcional)"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Arquivo DOCX *
                </label>
                <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-4 cursor-pointer hover:border-orange-500 transition-colors">
                  <FileText size={20} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-500 truncate">
                    {uploadFile ? uploadFile.name : "Clique para selecionar .docx"}
                  </span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
                  {uploadError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    if (!uploadName.trim() || !uploadFile) {
                      setUploadError("Preencha o nome e selecione o arquivo.");
                      return;
                    }
                    uploadMutation.mutate();
                  }}
                  disabled={uploadMutation.isPending}
                  className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm"
                >
                  <Upload size={15} />
                  {uploadMutation.isPending ? "Enviando..." : "Enviar e detectar campos"}
                </button>
                <button
                  onClick={() => { setShowUpload(false); setUploadError(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Carregando modelos...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum modelo cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Template row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <FileText size={20} className="text-orange-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{tpl.name}</div>
                  {tpl.description && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{tpl.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    v{tpl.version} Â· {tpl.fields.length} campo{tpl.fields.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleExpand(tpl.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
                  >
                    {expanded.has(tpl.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    Campos
                  </button>
                  <button
                    onClick={() => openEditor(tpl)}
                    className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Desativar o modelo "${tpl.name}"?`)) {
                        deleteMutation.mutate(tpl.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Desativar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Expanded fields list */}
              {expanded.has(tpl.id) && tpl.fields.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    {[...tpl.fields]
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((f, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded font-mono border ${
                            f.required
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {f.key}
                          {f.required && " *"}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit panel (slide-in style as full-width overlay) */}
      {editingId && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
          <div className="bg-white border-l border-gray-200 h-full w-full max-w-2xl overflow-y-auto flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-900">Editar Modelo</h3>
              <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Name & description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    DescriÃ§Ã£o
                  </label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Opcional"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Field Mapper */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Mapeamento de Campos
                  </label>
                  <button
                    type="button"
                    onClick={handleRedetect}
                    disabled={redetecting}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-600 transition-colors"
                  >
                    <RefreshCw size={12} className={redetecting ? "animate-spin" : ""} />
                    {redetecting ? "Detectando..." : "Re-detectar campos"}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <FieldMapper fields={editFields} onChange={setEditFields} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  A <strong className="text-gray-600">chave</strong> Ã© o identificador usado no formulÃ¡rio de geraÃ§Ã£o.
                  O <strong className="text-gray-600">placeholder</strong> deve corresponder exatamente ao texto entre colchetes no DOCX.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-800">Substituir arquivo DOCX</div>
                <p className="mt-1 text-xs text-gray-500">
                  Troque o arquivo base do template e atualize o mapeamento automaticamente.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 transition-colors hover:border-orange-500">
                    <FileText size={18} className="shrink-0 text-gray-400" />
                    <span className="max-w-[320px] truncate text-sm text-gray-500">
                      {replacementFile ? replacementFile.name : "Selecionar novo .docx"}
                    </span>
                    <input
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={(e) => setReplacementFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleReplaceTemplateDocx()}
                    disabled={!replacementFile || replacingFile}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={replacingFile ? "animate-spin" : ""} />
                    {replacingFile ? "Substituindo..." : "Substituir arquivo"}
                  </button>
                </div>
              </div>

              {/* Feedback */}
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm flex items-center gap-2">
                  <X size={14} />
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-emerald-700 text-sm flex items-center gap-2">
                  <Check size={14} />
                  Modelo salvo com sucesso.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm"
              >
                <Check size={15} />
                {saveMutation.isPending ? "Salvando..." : "Salvar alteraÃ§Ãµes"}
              </button>
              <button
                onClick={closeEditor}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: string } } }).response;
    return resp?.data?.detail ?? "Erro inesperado.";
  }
  return "Erro de conexÃ£o.";
}

