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
    className: "bg-slate-100 text-slate-700",
  },
  generating: {
    label: "Gerando",
    className: "bg-amber-100 text-amber-700",
  },
  completed: {
    label: "Concluido",
    className: "bg-emerald-100 text-emerald-700",
  },
  completed_with_errors: {
    label: "Concluido com erros",
    className: "bg-orange-100 text-orange-700",
  },
  failed: {
    label: "Falhou",
    className: "bg-red-100 text-red-700",
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
    <section className="rounded-[28px] border border-[#f2ddb2] bg-white/90 p-6 shadow-[0_22px_50px_rgba(17,17,17,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
            Historico
          </div>
          <h2 className="mt-1 text-xl font-bold text-[#17120e]">Lotes recentes</h2>
        </div>
        <div className="rounded-full border border-[#f3dfb1] bg-[#fff8e7] px-3 py-1 text-xs font-semibold text-[#9a5d00]">
          {batches.length} lote{batches.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {batches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ead8b1] bg-[#fffdf7] px-4 py-8 text-center text-sm text-stone-500">
            Nenhum lote importado ainda.
          </div>
        ) : (
          batches.map((batch) => (
            <button
              key={batch.id}
              onClick={() => onSelect(batch.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                selectedBatchId === batch.id
                  ? "border-[#ffbe45] bg-[#fff5d6] shadow-[0_10px_26px_rgba(255,183,32,0.12)]"
                  : "border-[#f2e0b6] bg-[#fffdf8] hover:border-[#ffcf71]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#17120e]">{batch.name}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {batch.template_name || "Template nao informado"}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta[batch.status].className}`}
                >
                  {statusMeta[batch.status].label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-stone-500">
                <div>
                  <div className="font-semibold text-stone-700">{batch.total_rows}</div>
                  <div>linhas</div>
                </div>
                <div>
                  <div className="font-semibold text-emerald-700">{batch.generated_rows}</div>
                  <div>gerados</div>
                </div>
                <div>
                  <div className="font-semibold text-red-600">{batch.failed_rows}</div>
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
      <div className="rounded-[32px] border border-[#f2ddb2] bg-[radial-gradient(circle_at_top,_rgba(255,212,84,0.24),_rgba(255,255,255,0.96)_52%)] p-8 shadow-[0_24px_60px_rgba(255,183,32,0.12)]">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd36d] bg-white/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#9a5d00]">
              <FileSpreadsheet size={14} />
              Modulo de lote
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[#181511]">
              Holerites em massa
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              Importe um CSV com os colaboradores, mapeie as colunas para o
              template DOCX e gere um pacote ZIP com todos os holerites em PDF.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[#eed8aa] bg-white/85 px-5 py-3 text-sm text-stone-600">
                <ShieldCheck size={16} className="text-[#f49d16]" />
                Sem calculo de folha dentro da plataforma
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[#eed8aa] bg-white/85 px-5 py-3 text-sm text-stone-600">
                <Sparkles size={16} className="text-[#f49d16]" />
                Geracao em massa com ZIP final
              </div>
            </div>
          </div>

          <div className="w-full max-w-md rounded-[28px] border border-[#f0ddb4] bg-white/90 p-6 shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
              Fluxo MVP
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#f49d16]" />
                <span>Template DOCX + CSV com cabecalho.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#f49d16]" />
                <span>Mapeamento por coluna antes da geracao.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#f49d16]" />
                <span>Historico do lote e download final em ZIP.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[28px] border border-[#f2ddb2] bg-white/90 p-6 shadow-[0_22px_50px_rgba(17,17,17,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1ca] text-[#f49d16]">
              <Upload size={20} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                Novo lote
              </div>
              <h2 className="text-xl font-bold text-[#17120e]">Importar base CSV</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Nome do lote
              </label>
              <input
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="Ex: Holerites Marco 2026"
                className="w-full rounded-2xl border border-[#ead8b1] bg-[#fffdf8] px-4 py-3 text-sm text-stone-800 outline-none transition-colors focus:border-[#ffbb3c]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Template DOCX
              </label>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="w-full rounded-2xl border border-[#ead8b1] bg-[#fffdf8] px-4 py-3 text-sm text-stone-800 outline-none transition-colors focus:border-[#ffbb3c]"
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
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Arquivo CSV
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-[#ead8b1] bg-[#fffdf8] px-4 py-4 transition-colors hover:border-[#ffbb3c]">
                <Files size={18} className="shrink-0 text-[#f49d16]" />
                <span className="truncate text-sm text-stone-600">
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
              <div className="rounded-2xl border border-[#f3dfb1] bg-[#fff8e7] px-4 py-3 text-sm text-stone-600">
                <div className="font-semibold text-stone-800">{selectedTemplate.name}</div>
                <div className="mt-1">
                  {selectedTemplate.fields.length} campo
                  {selectedTemplate.fields.length === 1 ? "" : "s"} detectado
                  {selectedTemplate.fields.length === 1 ? "" : "s"} no template.
                </div>
              </div>
            )}

            {importMutation.isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {extractError(importMutation.error)}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!batchName.trim() || !templateId || !csvFile || importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd92a] to-[#ff9a16] px-5 py-3 text-sm font-semibold text-[#181511] shadow-[0_16px_36px_rgba(255,173,24,0.25)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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

      <section className="mt-8 rounded-[28px] border border-[#f2ddb2] bg-white/90 p-6 shadow-[0_22px_50px_rgba(17,17,17,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
              Lote selecionado
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[#17120e]">
              {selectedBatch ? selectedBatch.name : "Selecione um lote"}
            </h2>
            <p className="mt-2 text-sm text-stone-500">
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
                className="inline-flex items-center gap-2 rounded-2xl border border-[#ead8b1] bg-[#fffdf8] px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-[#ffbb3c]"
              >
                <RefreshCw size={15} />
                Atualizar
              </button>
            </div>
          )}
        </div>

        {!selectedBatchId && !batchesLoading && (
          <div className="mt-6 rounded-2xl border border-dashed border-[#ead8b1] bg-[#fffdf8] px-4 py-10 text-center text-sm text-stone-500">
            Nenhum lote selecionado.
          </div>
        )}

        {batchLoading && selectedBatchId && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[#ead8b1] bg-[#fffdf8] px-4 py-10 text-sm text-stone-500">
            <Loader2 size={18} className="animate-spin" />
            Carregando lote...
          </div>
        )}

        {selectedBatch && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-[#f1dfb4] bg-[#fffdf8] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Linhas</div>
                <div className="mt-2 text-2xl font-bold text-[#17120e]">{selectedBatch.total_rows}</div>
              </div>
              <div className="rounded-2xl border border-[#f1dfb4] bg-[#fffdf8] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Mapeadas</div>
                <div className="mt-2 text-2xl font-bold text-[#17120e]">{mappedCount}</div>
              </div>
              <div className="rounded-2xl border border-[#f1dfb4] bg-[#fffdf8] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Geradas</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">{selectedBatch.generated_rows}</div>
              </div>
              <div className="rounded-2xl border border-[#f1dfb4] bg-[#fffdf8] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Erros</div>
                <div className="mt-2 text-2xl font-bold text-red-600">{selectedBatch.failed_rows}</div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[24px] border border-[#f1dfb4] bg-[#fffdf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#17120e]">Mapeamento de colunas</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      Defina qual coluna do CSV alimenta cada placeholder do template.
                    </p>
                  </div>
                  <div className="rounded-full border border-[#f3dfb1] bg-white px-3 py-1 text-xs font-semibold text-[#9a5d00]">
                    {selectedBatch.headers.length} coluna{selectedBatch.headers.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {selectedBatch.template_fields.map((field) => (
                    <div
                      key={field.key}
                      className="grid gap-2 rounded-2xl border border-[#f1dfb4] bg-white px-4 py-3 lg:grid-cols-[1fr_0.9fr]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-stone-800">
                          {field.display_label || field.label}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{field.key}</div>
                      </div>
                      <select
                        value={mapping[field.key] || ""}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-[#ead8b1] bg-[#fffdf8] px-3 py-2.5 text-sm text-stone-700 outline-none transition-colors focus:border-[#ffbb3c]"
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e7d19e] bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:border-[#ffbb3c] disabled:opacity-60"
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
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd92a] to-[#ff9a16] px-4 py-2.5 text-sm font-semibold text-[#181511] shadow-[0_16px_36px_rgba(255,173,24,0.22)] transition-opacity hover:opacity-95 disabled:opacity-60"
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
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Download size={15} />
                      Baixar ZIP
                    </button>
                  )}
                </div>

                {(mappingMutation.isError || generateMutation.isError || selectedBatch.last_error) && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {selectedBatch.last_error ||
                      extractError(mappingMutation.error || generateMutation.error)}
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-[#f1dfb4] bg-[#fffdf8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#17120e]">Preview do lote</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      Primeiras linhas importadas para conferência antes da geração.
                    </p>
                  </div>
                  {selectedBatch.preview_truncated && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#f3dfb1] bg-white px-3 py-1 text-xs font-semibold text-[#9a5d00]">
                      <AlertCircle size={13} />
                      Preview parcial
                    </div>
                  )}
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-[#ead8b1] bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#fff7e3] text-stone-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Colaborador</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Resumo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatch.preview_items.map((item) => (
                          <tr key={item.id} className="border-t border-[#f4e8c8]">
                            <td className="px-4 py-3 text-stone-500">{item.row_number}</td>
                            <td className="px-4 py-3 font-medium text-stone-800">
                              {item.employee_label || "Nao identificado"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  item.status === "generated"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {item.status === "generated"
                                  ? "Gerado"
                                  : item.status === "failed"
                                    ? "Erro"
                                    : "Pendente"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs leading-5 text-stone-500">
                              {Object.entries(item.row_data)
                                .slice(0, 3)
                                .map(([key, value]) => `${key}: ${value || "—"}`)
                                .join(" • ")}
                              {item.error_message ? (
                                <div className="mt-1 text-red-600">{item.error_message}</div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                  <div className="inline-flex items-center gap-2">
                    <Clock3 size={15} />
                    Importado em {formatDate(selectedBatch.created_at)}
                  </div>
                  {selectedBatch.completed_at && (
                    <div className="inline-flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600" />
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
