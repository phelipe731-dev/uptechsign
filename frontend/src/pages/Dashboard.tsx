import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  Send,
  Upload,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDocuments } from "../hooks/useDocuments";
import {
  getDashboardActivity,
  getDashboardPending,
  getDashboardStats,
  type DashboardStats,
} from "../services/dashboard";

type SectionKey = "recent" | "pending" | "activity";

type SectionVisibility = Record<SectionKey, boolean>;

const DASHBOARD_SECTION_STORAGE_KEY = "uptech-sign.dashboard.section-visibility";

const defaultSectionVisibility: SectionVisibility = {
  recent: true,
  pending: true,
  activity: true,
};

function loadSectionVisibility(): SectionVisibility {
  if (typeof window === "undefined") {
    return defaultSectionVisibility;
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY);
    if (!raw) {
      return defaultSectionVisibility;
    }

    const parsed = JSON.parse(raw) as Partial<SectionVisibility>;
    return {
      recent: parsed.recent ?? true,
      pending: parsed.pending ?? true,
      activity: parsed.activity ?? true,
    };
  } catch {
    return defaultSectionVisibility;
  }
}

const statusConfig: Record<
  string,
  {
    label: string;
    borderColor: string;
    textColor: string;
    bgColor: string;
    iconColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  completed: {
    label: "Finalizados",
    borderColor: "border-l-emerald-500",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-500",
    icon: CheckCircle,
  },
  in_signing: {
    label: "Em curso",
    borderColor: "border-l-amber-500",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-500",
    icon: Clock,
  },
  refused: {
    label: "Recusados",
    borderColor: "border-l-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
    iconColor: "text-red-500",
    icon: AlertCircle,
  },
  sent: {
    label: "Enviados",
    borderColor: "border-l-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    iconColor: "text-orange-500",
    icon: Send,
  },
};

const badgeConfig: Record<string, { label: string; classes: string }> = {
  generated: { label: "GERADO", classes: "bg-gray-100 text-gray-600" },
  sent: { label: "ENVIADO", classes: "bg-orange-50 text-orange-700" },
  in_signing: { label: "EM CURSO", classes: "bg-amber-50 text-amber-700" },
  completed: { label: "ASSINADO", classes: "bg-emerald-50 text-emerald-700" },
  refused: { label: "RECUSADO", classes: "bg-red-50 text-red-700" },
  expired: { label: "EXPIRADO", classes: "bg-gray-100 text-gray-500" },
  cancelled: { label: "CANCELADO", classes: "bg-gray-100 text-gray-500" },
};

const actionLabels: Record<string, string> = {
  "document.created": "Documento criado",
  "document.sent": "Enviado para assinatura",
  "document.completed": "Documento concluido",
  "document.cancelled": "Documento cancelado",
  "document.pdf_uploaded": "PDF manual enviado",
  "document.pdf_replaced": "PDF substituido",
  "document.partial_pdf_updated": "PDF parcial atualizado",
  "document.downloaded": "Arquivo baixado",
  "signature.viewed": "Link visualizado",
  "identity.confirmed": "Identidade confirmada",
  "otp.sent": "OTP enviado",
  "otp.verified": "OTP validado",
  "signature.signed": "Documento assinado",
  "signature.refused": "Assinatura recusada",
  "signature.resent": "Link reenviado",
};

export default function Dashboard() {
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>(
    () => loadSectionVisibility()
  );

  const { data: docs, isLoading: docsLoading } = useDocuments({
    page: 1,
    per_page: 8,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  });

  const { data: pending } = useQuery({
    queryKey: ["dashboard-pending"],
    queryFn: () => getDashboardPending(5),
    refetchInterval: 30_000,
  });

  const { data: activity } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => getDashboardActivity(10),
    refetchInterval: 30_000,
  });

  const statCards: { key: keyof DashboardStats; cfg: (typeof statusConfig)[string] }[] = [
    { key: "completed", cfg: statusConfig.completed },
    { key: "in_signing", cfg: statusConfig.in_signing },
    { key: "refused", cfg: statusConfig.refused },
    { key: "sent", cfg: statusConfig.sent },
  ];

  useEffect(() => {
    window.localStorage.setItem(
      DASHBOARD_SECTION_STORAGE_KEY,
      JSON.stringify(sectionVisibility)
    );
  }, [sectionVisibility]);

  function toggleSection(section: SectionKey) {
    setSectionVisibility((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel de documentos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acompanhe rascunhos, envios em andamento e atividade recente do escritorio.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/documents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={16} />
            Novo documento
          </Link>
          <Link
            to="/templates"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Upload size={16} />
            Templates
          </Link>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {statCards.map(({ key, cfg }) => {
            const Icon = cfg.icon;
            const count = stats[key] as number;
            return (
              <Link
                key={key}
                to={`/documents?status=${key}`}
                className={`rounded-xl border border-gray-200 border-l-4 ${cfg.borderColor} bg-white p-4 transition-shadow hover:shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${cfg.bgColor}`}>
                    <Icon size={18} className={cfg.iconColor} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${cfg.textColor}`}>{count}</div>
                    <div className="text-xs text-gray-500">{cfg.label}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white">
            <SectionHeader
              title="Documentos recentes"
              icon={<FolderOpen size={16} className="text-gray-400" />}
              meta={
                stats ? (
                  <span className="text-xs text-gray-400">
                    {stats.total} documento{stats.total !== 1 ? "s" : ""}
                  </span>
                ) : null
              }
              action={
                <Link
                  to="/documents"
                  className="text-xs font-medium text-orange-600 hover:text-orange-700"
                >
                  Ver todos
                </Link>
              }
              expanded={sectionVisibility.recent}
              onToggle={() => toggleSection("recent")}
            />

            {!sectionVisibility.recent ? (
              <CollapsedNotice
                text={`Visualizacao recolhida. ${docs?.items.length ?? 0} documento${
                  (docs?.items.length ?? 0) !== 1 ? "s" : ""
                } nesta lista.`}
              />
            ) : docsLoading ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">Carregando...</div>
            ) : !docs?.items.length ? (
              <div className="px-6 py-12 text-center">
                <FileText size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">Nenhum documento criado ainda.</p>
                <Link
                  to="/documents/new"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  <Plus size={16} />
                  Criar primeiro documento
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {docs.items.map((doc) => {
                  const badge = badgeConfig[doc.status] ?? badgeConfig.generated;
                  return (
                    <Link
                      key={doc.id}
                      to={`/documents/${doc.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{doc.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <span>{doc.source_type === "manual" ? "PDF manual" : "Template DOCX"}</span>
                          {doc.template_name && (
                            <>
                              <span className="text-gray-300">/</span>
                              <span className="truncate">{doc.template_name}</span>
                            </>
                          )}
                          <span className="text-gray-300">/</span>
                          <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white">
            <SectionHeader
              title="Pendencias de acompanhamento"
              expanded={sectionVisibility.pending}
              onToggle={() => toggleSection("pending")}
              action={
                <Link
                  to="/documents?status=in_signing"
                  className="text-xs font-medium text-orange-600 hover:text-orange-700"
                >
                  Ver fila
                </Link>
              }
            />

            {!sectionVisibility.pending ? (
              <CollapsedNotice
                text={`Visualizacao recolhida. ${pending?.length ?? 0} item${
                  (pending?.length ?? 0) !== 1 ? "s" : ""
                } em acompanhamento.`}
              />
            ) : !pending?.length ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                Nenhum documento pendente de acompanhamento.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pending.map((item) => (
                  <Link
                    key={item.id}
                    to={`/documents/${item.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-gray-50/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{item.title}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {item.source_type === "manual" ? "PDF manual" : item.template_name || "Template DOCX"}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                        {item.signed_signatories_count}/{item.signatories_count} assinaturas
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{
                          width:
                            item.signatories_count > 0
                              ? `${(item.signed_signatories_count / item.signatories_count) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>
                        Aguardando: <strong className="text-gray-700">{item.waiting_for ?? "interno"}</strong>
                      </span>
                      {item.last_activity_at && (
                        <span>
                          Ultima atividade:{" "}
                          {new Date(item.last_activity_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white">
          <SectionHeader
            title="Atividade recente"
            icon={<Activity size={16} className="text-orange-500" />}
            expanded={sectionVisibility.activity}
            onToggle={() => toggleSection("activity")}
          />

          {!sectionVisibility.activity ? (
            <CollapsedNotice
              text={`Visualizacao recolhida. ${activity?.length ?? 0} evento${
                (activity?.length ?? 0) !== 1 ? "s" : ""
              } disponivel.`}
            />
          ) : !activity?.length ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Sem atividade recente.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="text-sm text-gray-800">
                    {actionLabels[item.action] ?? item.action}
                  </div>
                  {item.document_id ? (
                    <Link
                      to={`/documents/${item.document_id}`}
                      className="mt-1 block truncate text-xs text-orange-600 hover:text-orange-700"
                    >
                      {item.document_title ?? "Abrir documento"}
                    </Link>
                  ) : item.document_title ? (
                    <div className="mt-1 truncate text-xs text-gray-500">{item.document_title}</div>
                  ) : null}
                  {item.actor_label && (
                    <div className="mt-1 text-xs text-gray-500">Ator: {item.actor_label}</div>
                  )}
                  <div className="mt-1 text-[11px] text-gray-300">
                    {new Date(item.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  meta,
  action,
  expanded,
  onToggle,
}: {
  title: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-4 ${
        expanded ? "border-b border-gray-100" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {meta}
      </div>

      <div className="flex items-center gap-2">
        {action}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadfd7] bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Ocultar" : "Reabrir"}
        </button>
      </div>
    </div>
  );
}

function CollapsedNotice({ text }: { text: string }) {
  return <div className="px-5 py-4 text-xs text-gray-400">{text}</div>;
}
