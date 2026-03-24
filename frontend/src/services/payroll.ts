import api from "./api";
import type { PayrollBatch, PayrollBatchListItem } from "../types";

export async function getPayrollBatches(): Promise<PayrollBatchListItem[]> {
  const res = await api.get<PayrollBatchListItem[]>("/payroll-batches/");
  return res.data;
}

export async function getPayrollBatch(batchId: string): Promise<PayrollBatch> {
  const res = await api.get<PayrollBatch>(`/payroll-batches/${batchId}`);
  return res.data;
}

export async function importPayrollBatch(data: {
  name: string;
  template_id: string;
  file: File;
}): Promise<PayrollBatch> {
  const form = new FormData();
  form.append("name", data.name);
  form.append("template_id", data.template_id);
  form.append("file", data.file);
  const res = await api.post<{ batch: PayrollBatch }>("/payroll-batches/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.batch;
}

export async function updatePayrollBatchMapping(
  batchId: string,
  column_mapping: Record<string, string>
): Promise<PayrollBatch> {
  const res = await api.post<PayrollBatch>(`/payroll-batches/${batchId}/mapping`, {
    column_mapping,
  });
  return res.data;
}

export async function generatePayrollBatch(batchId: string): Promise<PayrollBatch> {
  const res = await api.post<{ batch: PayrollBatch }>(`/payroll-batches/${batchId}/generate`);
  return res.data.batch;
}

export async function downloadPayrollBatchZip(batchId: string, filename?: string): Promise<void> {
  const response = await api.get(`/payroll-batches/${batchId}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data as BlobPart], {
    type: (response.headers["content-type"] as string) || "application/zip",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename || `holerites-${batchId}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}
