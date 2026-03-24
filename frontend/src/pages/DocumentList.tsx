import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  Users,
  X,
} from "lucide-react";
import { useDocuments, useTemplates } from "../hooks/useDocuments";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "generated", label: "Gerado" },
  { value: "sent", label: "Enviado" },
  { value: "in_signing", label: "Em curso" },
  { value: "completed", label: "Assinado" },
  { value: "refused", label: "Recusado" },
  { value: "expired", label: "Expirado" },
  { value: "cancelled", label: "Cancelado" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "Todas as origens" },
  { value: "template", label: "Template DOCX" },
  { value: "manual", label: "PDF manual" },
];

const badgeConfig: Record<string, { label: string; classes: string }> = {
  generated: { label: "GERADO", classes: "bg-gray-100 text-gray-600" },
  sent: { label: "ENVIADO", classes: "bg-orange-50 text-orange-700" },
  in_signing: { label: "EM CURSO", classes: "bg-amber-50 text-amber-700" },
  completed: { label: "ASSINADO", classes: "bg-emerald-50 text-emerald-700" },
  refused: { label: "RECUSADO", classes: "bg-red-50 text-red-700" },
  expired: { label: "EXPIRADO", classes: "bg-gray-100 text-gray-500" },
  cancelled: { label: "CANCELADO", classes: "bg-gray-100 text-gray-500" },
};

export default function DocumentList() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [templateFilter, setTemplateFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const perPage = 15;

  const { data: templates } = useTemplates();
  const { data, isLoading } = useDocuments({
    page,
    per_page: perPage,
    status: statusFilter || undefined,
    template_id: templateFilter || undefined,
    source: sourceFilter || undefined,
    search: search || undefined,
  });

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setStatusFilter("");
    setTemplateFilter("");
    setSourceFilter("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;
  const hasFilters = !!statusFilter || !!templateFilter || !!sourceFilter || !!search;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {data ? `${data.total} documento(s) encontrados` : "Carregando lista..."}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_200px_220px_200px_auto]">
          <form onSubmit={handleSearch} className="min-w-0">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Titulo, ID, nome ou email do signatario"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </form>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={templateFilter}
            onChange={(event) => {
              setTemplateFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none"
          >
            <option value="">Todos os modelos</option>
            {templates?.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-orange-500 focus:outline-none"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-end gap-3">
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
                Limpar
              </button>
            )}
            <div className="text-xs text-gray-400">
              {data &&
                `${(page - 1) * perPage + 1}-${Math.min(page * perPage, data.total)} de ${data.total}`}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Carregando...</div>
        ) : !data?.items.length ? (
          <div className="px-6 py-14 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Nenhum documento encontrado.</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1.5fr)_170px_180px_170px] gap-4 border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div>Documento</div>
              <div>Status</div>
              <div>Origem e modelo</div>
              <div>Andamento</div>
            </div>

            <div className="divide-y divide-gray-50">
              {data.items.map((doc) => {
                const badge = badgeConfig[doc.status] ?? badgeConfig.generated;
                return (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}`}
                    className="grid grid-cols-[minmax(0,1.5fr)_170px_180px_170px] gap-4 px-5 py-4 transition-colors hover:bg-orange-50/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gray-100 p-2 text-gray-500">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{doc.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                            <span>/</span>
                            <span>ID {doc.id.slice(0, 8)}</span>
                            {doc.last_activity_at && (
                              <>
                                <span>/</span>
                                <span>
                                  Ativo em{" "}
                                  {new Date(doc.last_activity_at).toLocaleDateString("pt-BR")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start pt-1">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 text-xs text-gray-500">
                      <div>
                        {doc.source_type === "manual" ? "PDF manual" : "Template DOCX"}
                      </div>
                      <div className="truncate text-gray-400">
                        {doc.template_name ?? "Sem modelo associado"}
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Users size={13} />
                        {doc.signed_signatories_count}/{doc.signatories_count} assinaturas
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{
                            width:
                              doc.signatories_count > 0
                                ? `${(doc.signed_signatories_count / doc.signatories_count) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <span className="text-xs text-gray-400">
              Pagina {page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

