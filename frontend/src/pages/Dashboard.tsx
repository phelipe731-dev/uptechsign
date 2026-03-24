import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
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
    borderColor: "border-l-[#22C55E]",
    textColor: "text-[#22C55E]",
    bgColor: "bg-green-50",
    iconColor: "text-[#22C55E]",
    icon: CheckCircle,
  },
  in_signing: {
    label: "Em curso",
    borderColor: "border-l-[#F59E0B]",
    textColor: "text-[#F59E0B]",
    bgColor: "bg-[#FFF7ED]",
    iconColor: "text-[#F59E0B]",
    icon: Clock,
  },
  refused: {
    label: "Recusados",
    borderColor: "border-l-[#EF4444]",
    textColor: "text-[#EF4444]",
    bgColor: "bg-red-50",
    iconColor: "text-[#EF4444]",
    icon: AlertCircle,
  },
  sent: {
    label: "Enviados",
    borderColor: "border-l-[#A0AEC0]",
    textColor: "text-[#4A5568]",
    bgColor: "bg-[#F7F9FC]",
    iconColor: "text-[#A0AEC0]",
    icon: Send,
  },
};

const badgeConfig: Record<string, { label: string; classes: string }> = {
  generated: { label: "GERADO", classes: "bg-[#F7F9FC] text-[#A0AEC0]" },
  sent: { label: "ENVIADO", classes: "bg-[#F7F9FC] text-[#4A5568]" },
  in_signing: { label: "EM CURSO", classes: "bg-[#FFF7ED] text-[#D97706]" },
  completed: { label: "ASSINADO", classes: "bg-green-50 text-[#22C55E]" },
  refused: { label: "RECUSADO", classes: "bg-red-50 text-[#EF4444]" },
  expired: { label: "EXPIRADO", classes: "bg-[#F7F9FC] text-[#A0AEC0]" },
  cancelled: { label: "CANCELADO", classes: "bg-[#F7F9FC] text-[#A0AEC0]" },
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
    <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-8">
      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="rounded-[18px] border border-[#E6EAF0] bg-white p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FDE7B3] bg-[#FFF7ED] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#D97706]">
            <Sparkles size={14} />
            Operacao central
          </div>
          <h2 className="mt-5 max-w-3xl text-[32px] font-semibold leading-tight tracking-[-0.03em] text-[#000000]">
            Um painel clean para gerar, enviar e acompanhar documentos sem friccao.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#4A5568]">
            Reuna templates, rascunhos, assinaturas e trilhas de auditoria em uma
            experiencia mais clara, corporativa e previsivel para o escritorio.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/documents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D97706]"
            >
              <Plus size={16} />
              Criar novo documento
            </Link>
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-5 py-3 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB]"
            >
              <FolderOpen size={16} />
              Abrir base documental
            </Link>
          </div>
        </div>

        <div className="rounded-[18px] border border-[#E6EAF0] bg-white p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
            Resumo rapido
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[#000000]">
            O que precisa de atencao agora
          </h3>
          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-[#E6EAF0] bg-[#FBFCFE] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#111827]">
                    Documentos em curso
                  </div>
                  <div className="mt-1 text-xs text-[#4A5568]">
                    Fluxos com assinaturas ainda em andamento.
                  </div>
                </div>
                <div className="rounded-xl bg-[#FFF7ED] px-3 py-2 text-lg font-semibold text-[#D97706]">
                  {stats?.in_signing ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6EAF0] bg-[#FBFCFE] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#111827]">
                    Envios aguardando retorno
                  </div>
                  <div className="mt-1 text-xs text-[#4A5568]">
                    Links ja enviados e pendentes de acao do signatario.
                  </div>
                </div>
                <div className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-lg font-semibold text-[#4A5568]">
                  {stats?.sent ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6EAF0] bg-[#FFF7ED] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-[#F59E0B]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#111827]">
                    Painel pronto para operacao continua
                  </div>
                  <div className="mt-1 text-xs leading-6 text-[#4A5568]">
                    Visualizacao central de desempenho, pendencias e atividade
                    recente com destaque sempre em laranja.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ key, cfg }) => {
            const Icon = cfg.icon;
            const count = stats[key] as number;
            return (
              <Link
                key={key}
                to={`/documents?status=${key}`}
                className={`rounded-[16px] border border-[#E6EAF0] border-l-4 ${cfg.borderColor} bg-white p-5 transition-all hover:border-[#F3D9A4] hover:bg-[#FFFCF7]`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-xl p-3 ${cfg.bgColor}`}>
                    <Icon size={18} className={cfg.iconColor} />
                  </div>
                  <ArrowRight size={16} className="text-[#CBD5E1]" />
                </div>
                <div className="mt-5">
                  <div className={`text-3xl font-semibold tracking-tight ${cfg.textColor}`}>
                    {count}
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#111827]">{cfg.label}</div>
                  <div className="mt-2 text-xs leading-5 text-[#94A3B8]">
                    {key === "completed" && "Documentos finalizados e fechados com sucesso."}
                    {key === "in_signing" && "Fluxos aguardando conclusao das assinaturas."}
                    {key === "refused" && "Itens recusados que merecem nova abordagem."}
                    {key === "sent" && "Links enviados e aguardando a primeira acao."}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="space-y-6">
          {/* Recent documents */}
          <section className="rounded-[18px] border border-[#E6EAF0] bg-white">
            <SectionHeader
              title="Documentos recentes"
              icon={<FolderOpen size={16} className="text-[#A0AEC0]" />}
              meta={
                stats ? (
                  <span className="text-xs text-[#A0AEC0]">
                    {stats.total} documento{stats.total !== 1 ? "s" : ""}
                  </span>
                ) : null
              }
              action={
                <Link
                  to="/documents"
                  className="text-xs font-medium text-[#F59E0B] hover:text-[#D97706]"
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
              <div className="px-6 py-12 text-center text-sm text-[#A0AEC0]">Carregando...</div>
            ) : !docs?.items.length ? (
              <div className="px-6 py-12 text-center">
                <FileText size={40} className="mx-auto mb-3 text-[#E6EAF0]" />
                <p className="text-sm text-[#4A5568]">Nenhum documento criado ainda.</p>
                <Link
                  to="/documents/new"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#F59E0B] hover:text-[#D97706]"
                >
                  <Plus size={16} />
                  Criar primeiro documento
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {docs.items.map((doc) => {
                  const badge = badgeConfig[doc.status] ?? badgeConfig.generated;
                  return (
                    <Link
                      key={doc.id}
                      to={`/documents/${doc.id}`}
                      className="group flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-[#F9FAFB]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-[#111827] transition-colors group-hover:text-[#000000]">
                          {doc.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#A0AEC0]">
                          <span>{doc.source_type === "manual" ? "PDF manual" : "Template DOCX"}</span>
                          {doc.template_name && (
                            <>
                              <span className="text-[#E6EAF0]">/</span>
                              <span className="truncate">{doc.template_name}</span>
                            </>
                          )}
                          <span className="text-[#E6EAF0]">/</span>
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

          {/* Pending follow-ups */}
          <section className="rounded-[18px] border border-[#E6EAF0] bg-white">
            <SectionHeader
              title="Pendencias de acompanhamento"
              expanded={sectionVisibility.pending}
              onToggle={() => toggleSection("pending")}
              action={
                <Link
                  to="/documents?status=in_signing"
                  className="text-xs font-medium text-[#F59E0B] hover:text-[#D97706]"
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
              <div className="px-6 py-10 text-center text-sm text-[#A0AEC0]">
                Nenhum documento pendente de acompanhamento.
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {pending.map((item) => (
                  <Link
                    key={item.id}
                    to={`/documents/${item.id}`}
                    className="block px-6 py-5 transition-colors hover:bg-[#F9FAFB]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-[#111827]">
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-[#A0AEC0]">
                          {item.source_type === "manual" ? "PDF manual" : item.template_name || "Template DOCX"}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-medium text-[#D97706]">
                        {item.signed_signatories_count}/{item.signatories_count} assinaturas
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#F59E0B]"
                        style={{
                          width:
                            item.signatories_count > 0
                              ? `${(item.signed_signatories_count / item.signatories_count) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#4A5568]">
                      <span>
                        Aguardando: <strong className="text-[#1A202C]">{item.waiting_for ?? "interno"}</strong>
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

        {/* Activity sidebar */}
        <section className="rounded-[18px] border border-[#E6EAF0] bg-white">
          <SectionHeader
            title="Atividade recente"
            icon={<Activity size={16} className="text-[#F59E0B]" />}
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
            <div className="px-5 py-10 text-center text-sm text-[#A0AEC0]">Sem atividade recente.</div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {activity.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="text-sm text-[#1A202C]">
                    {actionLabels[item.action] ?? item.action}
                  </div>
                  {item.document_id ? (
                    <Link
                      to={`/documents/${item.document_id}`}
                      className="mt-1 block truncate text-xs text-[#F59E0B] hover:text-[#D97706]"
                    >
                      {item.document_title ?? "Abrir documento"}
                    </Link>
                  ) : item.document_title ? (
                    <div className="mt-1 truncate text-xs text-[#4A5568]">{item.document_title}</div>
                  ) : null}
                  {item.actor_label && (
                    <div className="mt-1 text-xs text-[#4A5568]">Ator: {item.actor_label}</div>
                  )}
                  <div className="mt-1 text-[11px] text-[#A0AEC0]">
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
      className={`flex items-center justify-between px-6 py-5 ${
        expanded ? "border-b border-[#F1F5F9]" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#F59E0B]">
            {icon}
          </span>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-[#000]">{title}</h2>
        {meta}
      </div>

      <div className="flex items-center gap-2">
        {action}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-xs font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB]"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Ocultar" : "Reabrir"}
        </button>
      </div>
    </div>
  );
}

function CollapsedNotice({ text }: { text: string }) {
  return <div className="px-6 py-5 text-xs text-[#A0AEC0]">{text}</div>;
}
