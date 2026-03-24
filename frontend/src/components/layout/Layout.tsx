import { Link, useLocation } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  Home,
  LayoutTemplate,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import PhSignLogo from "../branding/PhSignLogo";

const navItems = [
  { to: "/", label: "Painel", icon: Home },
  { to: "/documents", label: "Documentos", icon: FolderOpen },
  { to: "/holerites", label: "Holerites", icon: FileText },
  { to: "/templates", label: "Modelos", icon: LayoutTemplate },
  { to: "/settings", label: "Configuracoes", icon: Settings },
];

function resolvePageMeta(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    return {
      eyebrow: "Workspace",
      title: "Painel de operacao",
      subtitle:
        "Acompanhe documentos, envios, assinaturas e atividades do escritorio em um unico lugar.",
    };
  }

  if (pathname.startsWith("/documents/new")) {
    return {
      eyebrow: "Documentos",
      title: "Novo documento",
      subtitle:
        "Crie um fluxo completo com template, signatarios, autenticacao e envio sem sair da plataforma.",
    };
  }

  if (pathname.startsWith("/documents")) {
    return {
      eyebrow: "Documentos",
      title: "Gestao de documentos",
      subtitle:
        "Organize rascunhos, acompanhe assinaturas e centralize o historico operacional do escritorio.",
    };
  }

  if (pathname.startsWith("/holerites")) {
    return {
      eyebrow: "Lotes",
      title: "Holerites em massa",
      subtitle:
        "Importe planilhas, gere PDFs em lote e distribua arquivos com padrao operacional e historico.",
    };
  }

  if (pathname.startsWith("/templates")) {
    return {
      eyebrow: "Modelos",
      title: "Biblioteca de templates",
      subtitle:
        "Gerencie modelos DOCX, campos dinamicos e padroes utilizados pelo escritorio em um unico acervo.",
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      eyebrow: "Configuracoes",
      title: "Configuracoes da plataforma",
      subtitle:
        "Ajuste identidade, SMTP, assinatura institucional, templates e parametros operacionais.",
    };
  }

  if (pathname.startsWith("/users")) {
    return {
      eyebrow: "Administracao",
      title: "Usuarios do workspace",
      subtitle:
        "Controle acessos, papeis e pessoas com permissao para operar dentro da plataforma.",
    };
  }

  return {
    eyebrow: "Workspace",
    title: "Uptech Sign",
    subtitle:
      "Plataforma de assinatura digital com operacao centralizada para documentos e fluxos internos.",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const pageMeta = resolvePageMeta(location.pathname);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#4A5568]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-[#E6EAF0] bg-white lg:flex">
          <div className="border-b border-[#E6EAF0] px-6 py-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FDE7B3] bg-[#FFF7ED] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D97706]">
              Workspace SaaS
            </div>
            <Link to="/" className="block">
              <PhSignLogo className="h-16 w-auto" />
              <div className="mt-3 max-w-[190px] text-[12px] leading-5 text-[#94A3B8]">
                Assinatura digital moderna, clara e segura para operacao documental.
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1.5 px-4 py-6">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
              Navegacao
            </div>
            {navItems.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/" || location.pathname.startsWith("/dashboard")
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    active
                      ? "bg-[#FFF7ED] text-[#F59E0B]"
                      : "text-[#4A5568] hover:bg-[#F1F5F9] hover:text-[#111827]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      active
                        ? "bg-white text-[#F59E0B] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                        : "bg-transparent text-[#94A3B8] group-hover:bg-white group-hover:text-[#F59E0B]"
                    }`}
                  >
                    <item.icon size={18} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}

            {user?.role === "admin" && (
              <>
                <div className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
                  Administracao
                </div>
                <Link
                  to="/users"
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    location.pathname.startsWith("/users")
                      ? "bg-[#FFF7ED] text-[#F59E0B]"
                      : "text-[#4A5568] hover:bg-[#F1F5F9] hover:text-[#111827]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      location.pathname.startsWith("/users")
                        ? "bg-white text-[#F59E0B] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                        : "bg-transparent text-[#94A3B8] group-hover:bg-white group-hover:text-[#F59E0B]"
                    }`}
                  >
                    <Users size={18} />
                  </span>
                  <span className="flex-1">Usuarios</span>
                </Link>
              </>
            )}
          </nav>

          <div className="border-t border-[#E6EAF0] p-4">
            <div className="rounded-2xl border border-[#E6EAF0] bg-[#FBFCFE] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-sm font-bold text-[#F59E0B]">
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#111827]">
                    {user?.full_name}
                  </div>
                  <div className="truncate text-[11px] text-[#94A3B8]">
                    {user?.email}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white hover:text-[#EF4444]"
                  title="Sair"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#E6EAF0] bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-6 px-6 py-5 lg:px-8">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A0AEC0]">
                  {pageMeta.eyebrow}
                </div>
                <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-[#000000]">
                  {pageMeta.title}
                </h1>
                <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-[#4A5568] lg:block">
                  {pageMeta.subtitle}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  to="/documents"
                  className="hidden rounded-lg border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-medium text-[#4A5568] transition-colors hover:bg-[#F9FAFB] lg:inline-flex"
                >
                  Ver documentos
                </Link>
                <Link
                  to="/documents/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706]"
                >
                  <Plus size={16} />
                  Criar documento
                </Link>
              </div>
            </div>
          </header>

          <main className="min-h-[calc(100vh-97px)] flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
