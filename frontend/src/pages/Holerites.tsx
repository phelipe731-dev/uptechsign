import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Files,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getTemplates } from "../services/documents";
import {
  downloadPayrollBatchZip,
  generatePayrollBatch,
  getPayrollBatch,
  getPayrollBatches,
  importPayrollBatch,
  updatePayrollBatchMapping,
} from "../services/payroll";
import type { PayrollBatch, PayrollBatchListItem, Template } from "../types";

const statusMeta: Record<
  PayrollBatch["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Rascunho",
    className: "bg-[#F7F9FC] text-[#A0AEC0]",
  },
  generating: {
    label: "Gerando",
    className: "bg-[#FFF7ED] text-[#D97706]",
  },
  completed: {
    label: "Concluido",
    className: "bg-green-50 text-[#22C55E]",
  },
  completed_with_errors: {
    label: "Concluido com erros",
    className: "bg-[#FFF7ED] text-[#D97706]",
  },
  failed: {
    label: "Falhou",
    className: "bg-red-50 text-[#EF4444]",
  },
};

function extractError(err: unknown): string {
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
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((item) => item.msg || "Erro de validacao").join(", ");
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Nao foi possivel concluir a operacao.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function BatchListCard({
  batches,
  selectedBatchId,
  onSelect,
}: {
  batches: PayrollBatchListItem[];
  selectedBatchId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
            Historico
          </div>
          <h2 className="mt-1 text-xl font-bold text-[#000]">Lotes recentes</h2>
        </div>
        <div className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#D97706]">
          {batches.length} lote{batches.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {batches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E6EAF0] bg-[#F7F9FC] px-4 py-8 text-center text-sm text-[#4A5568]">
            Nenhum lote importado ainda.
          </div>
        ) : (
          batches.map((batch) => (
            <button
              key={batch.id}
              onClick={() => onSelect(batch.id)}
              className={`w-full rounded-lg border px-4 py-4 text-left transition-all ${
                selectedBatchId === batch.id
                  ? "border-[#F59E0B] bg-[#FFF7ED]"
                  : "border-[#E6EAF0] bg-[#F7F9FC] hover:border-[#F59E0B]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#000]">{batch.name}</div>
                  <div className="mt-1 text-xs text-[#4A5568]">
                    {batch.template_name || "Template nao informado"}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta[batch.status].className}`}
                >
                  {statusMeta[batch.status].label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#4A5568]">
                <div>
                  <div className="font-semibold text-[#1A202C]">{batch.total_rows}</div>
                  <div>linhas</div>
                </div>
                <div>
                  <div className="font-semibold text-[#22C55E]">{batch.generated_rows}</div>
                  <div>gerados</div>
                </div>
                <div>
                  <div className="font-semibold text-[#EF4444]">{batch.failed_rows}</div>
                  <div>erros</div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export default function Holerites() {
  const queryClient = useQueryClient();
  const [batchName, setBatchName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["payroll-batches"],
    queryFn: getPayrollBatches,
  });

  const { data: selectedBatch, isLoading: batchLoading } = useQuery({
    queryKey: ["payroll-batch", selectedBatchId],
    queryFn: () => getPayrollBatch(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
      return;
    }
    if (selectedBatchId && !batches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(batches[0]?.id ?? null);
    }
  }, [batches, selectedBatchId]);

  useEffect(() => {
    if (selectedBatch) {
      setMapping(selectedBatch.column_mapping || {});
    }
  }, [selectedBatch]);

  const importMutation = useMutation({
    mutationFn: () =>
      importPayrollBatch({
        name: batchName,
        template_id: templateId,
        file: csvFile!,
      }),
    onSuccess: async (batch) => {
      setBatchName("");
      setCsvFile(null);
      setSelectedBatchId(batch.id);
      await queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
      queryClient.setQueryData(["payroll-batch", batch.id], batch);
    },
  });

  const mappingMutation = useMutation({
    mutationFn: () => updatePayrollBatchMapping(selectedBatchId!, mapping),
    onSuccess: (batch) => {
      queryClient.setQueryData(["payroll-batch", batch.id], batch);
      queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generatePayrollBatch(selectedBatchId!),
    onSuccess: (batch) => {
      queryClient.setQueryData(["payroll-batch", batch.id], batch);
      queryClient.invalidateQueries({ queryKey: ["payroll-batches"] });
    },
  });

  const selectedTemplate = useMemo<Template | undefined>(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );

  const mappedCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping]
  );

  const handleImport = () => {
    if (!batchName.trim() || !templateId || !csvFile) {
      return;
    }
    importMutation.mutate();
  };

  const handleDownloadZip = async () => {
    if (!selectedBatch) return;
    await downloadPayrollBatchZip(selectedBatch.id, `${selectedBatch.name}.zip`);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Hero section */}
      <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#D97706]">
              <FileSpreadsheet size={14} />
              Modulo de lote
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[#000]">
              Holerites em massa
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4A5568]">
              Importe um CSV com os colaboradores, mapeie as colunas para o
              template DOCX e gere um pacote ZIP com todos os holerites em PDF.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-5 py-3 text-sm text-[#4A5568]">
                <ShieldCheck size={16} className="text-[#F59E0B]" />
                Sem calculo de folha dentro da plataforma
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-5 py-3 text-sm text-[#4A5568]">
                <Sparkles size={16} className="text-[#F59E0B]" />
                Geracao em massa com ZIP final
              </div>
            </div>
          </div>

          <div className="w-full max-w-md rounded-[10px] border border-[#E6EAF0] bg-[#F7F9FC] p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
              Fluxo MVP
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#4A5568]">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                <span>Template DOCX + CSV com cabecalho.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                <span>Mapeamento por coluna antes da geracao.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                <span>Historico do lote e download final em ZIP.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import + batch list */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[10px] border border-[#E6EAF0] bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF7ED] text-[#F59E0B]">
              <Upload size={20} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
                Novo lote
              </div>
              <h2 className="text-xl font-bold text-[#000]">Importar base CSV</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A202C]">
                Nome do lote
              </label>
              <input
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="Ex: Holerites Marco 2026"
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 text-sm text-[#1A202C] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A202C]">
                Template DOCX
              </label>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 text-sm text-[#1A202C] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED]"
              >
                <option value="">Selecione um modelo</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A202C]">
                Arquivo CSV
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-[#E6EAF0] bg-[#F7F9FC] px-4 py-4 transition-colors hover:border-[#F59E0B]">
                <Files size={18} className="shrink-0 text-[#F59E0B]" />
                <span className="truncate text-sm text-[#4A5568]">
                  {csvFile ? csvFile.name : "Clique para selecionar o CSV"}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border border-[#E6EAF0] bg-[#FFF7ED] px-4 py-3 text-sm text-[#4A5568]">
                <div className="font-semibold text-[#1A202C]">{selectedTemplate.name}</div>
                <div className="mt-1">
                  {selectedTemplate.fields.length} campo
                  {selectedTemplate.fields.length === 1 ? "" : "s"} detectado
                  {selectedTemplate.fields.length === 1 ? "" : "s"} no template.
                </div>
              </div>
            )}

            {importMutation.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
                {extractError(importMutation.error)}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!batchName.trim() || !templateId || !csvFile || importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Importar lote
            </button>
          </div>
        </section>

        <BatchListCard
          batches={batches}
          selectedBatchId={selectedBatchId}
          onSelect={setSelectedBatchId}
        />
      </div>

      {/* Selected batch detail */}
      <section className="mt-8 rounded-[10px] border border-[#E6EAF0] bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
              Lote selecionado
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[#000]">
              {selectedBatch ? selectedBatch.name : "Selecione um lote"}
            </h2>
            <p className="mt-2 text-sm text-[#4A5568]">
              {selectedBatch
                ? `${selectedBatch.template_name || "Template nao informado"} • importado em ${formatDate(selectedBatch.created_at)}`
                : "Importe um CSV ou escolha um lote da lista para continuar."}
            </p>
          </div>

          {selectedBatch && (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusMeta[selectedBatch.status].className}`}
              >
                {statusMeta[selectedBatch.status].label}
              </span>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["payroll-batch", selectedBatch.id] })}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB]"
              >
                <RefreshCw size={15} />
                Atualizar
              </button>
            </div>
          )}
        </div>

        {!selectedBatchId && !batchesLoading && (
          <div className="mt-6 rounded-lg border border-dashed border-[#E6EAF0] bg-[#F7F9FC] px-4 py-10 text-center text-sm text-[#4A5568]">
            Nenhum lote selecionado.
          </div>
        )}

        {batchLoading && selectedBatchId && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-dashed border-[#E6EAF0] bg-[#F7F9FC] px-4 py-10 text-sm text-[#4A5568]">
            <Loader2 size={18} className="animate-spin" />
            Carregando lote...
          </div>
        )}

        {selectedBatch && (
          <div className="mt-6 space-y-6">
            {/* Stats row */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0AEC0]">Linhas</div>
                <div className="mt-2 text-2xl font-bold text-[#000]">{selectedBatch.total_rows}</div>
              </div>
              <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0AEC0]">Mapeadas</div>
                <div className="mt-2 text-2xl font-bold text-[#000]">{mappedCount}</div>
              </div>
              <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0AEC0]">Geradas</div>
                <div className="mt-2 text-2xl font-bold text-[#22C55E]">{selectedBatch.generated_rows}</div>
              </div>
              <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[#A0AEC0]">Erros</div>
                <div className="mt-2 text-2xl font-bold text-[#EF4444]">{selectedBatch.failed_rows}</div>
              </div>
            </div>

            {/* Mapping + Preview */}
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#000]">Mapeamento de colunas</h3>
                    <p className="mt-1 text-sm text-[#4A5568]">
                      Defina qual coluna do CSV alimenta cada placeholder do template.
                    </p>
                  </div>
                  <div className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#D97706]">
                    {selectedBatch.headers.length} coluna{selectedBatch.headers.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {selectedBatch.template_fields.map((field) => (
                    <div
                      key={field.key}
                      className="grid gap-2 rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 lg:grid-cols-[1fr_0.9fr]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1A202C]">
                          {field.display_label || field.label}
                        </div>
                        <div className="mt-1 text-xs text-[#4A5568]">{field.key}</div>
                      </div>
                      <select
                        value={mapping[field.key] || ""}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm text-[#4A5568] outline-none transition-colors focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED]"
                      >
                        <option value="">Nao mapear agora</option>
                        {selectedBatch.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => mappingMutation.mutate()}
                    disabled={mappingMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-semibold text-[#4A5568] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60"
                  >
                    {mappingMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                    Salvar mapeamento
                  </button>

                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || mappingMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-60"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    Gerar holerites
                  </button>

                  {selectedBatch.zip_ready && (
                    <button
                      onClick={handleDownloadZip}
                      className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-[#22C55E] transition-colors hover:bg-green-100"
                    >
                      <Download size={15} />
                      Baixar ZIP
                    </button>
                  )}
                </div>

                {(mappingMutation.isError || generateMutation.isError || selectedBatch.last_error) && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
                    {selectedBatch.last_error ||
                      extractError(mappingMutation.error || generateMutation.error)}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#000]">Preview do lote</h3>
                    <p className="mt-1 text-sm text-[#4A5568]">
                      Primeiras linhas importadas para conferência antes da geração.
                    </p>
                  </div>
                  {selectedBatch.preview_truncated && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#D97706]">
                      <AlertCircle size={13} />
                      Preview parcial
                    </div>
                  )}
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-[#E6EAF0] bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#F7F9FC] text-[#4A5568]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Colaborador</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Resumo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatch.preview_items.map((item) => (
                          <tr key={item.id} className="border-t border-[#E6EAF0]">
                            <td className="px-4 py-3 text-[#A0AEC0]">{item.row_number}</td>
                            <td className="px-4 py-3 font-medium text-[#1A202C]">
                              {item.employee_label || "Nao identificado"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  item.status === "generated"
                                    ? "bg-green-50 text-[#22C55E]"
                                    : item.status === "failed"
                                      ? "bg-red-50 text-[#EF4444]"
                                      : "bg-[#F7F9FC] text-[#A0AEC0]"
                                }`}
                              >
                                {item.status === "generated"
                                  ? "Gerado"
                                  : item.status === "failed"
                                    ? "Erro"
                                    : "Pendente"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs leading-5 text-[#4A5568]">
                              {Object.entries(item.row_data)
                                .slice(0, 3)
                                .map(([key, value]) => `${key}: ${value || "—"}`)
                                .join(" • ")}
                              {item.error_message ? (
                                <div className="mt-1 text-[#EF4444]">{item.error_message}</div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#4A5568]">
                  <div className="inline-flex items-center gap-2">
                    <Clock3 size={15} />
                    Importado em {formatDate(selectedBatch.created_at)}
                  </div>
                  {selectedBatch.completed_at && (
                    <div className="inline-flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-[#22C55E]" />
                      Ultima geração em {formatDate(selectedBatch.completed_at)}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
