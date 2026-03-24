import { Link, useLocation } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  Settings,
  Users,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import PhSignLogo from "../branding/PhSignLogo";

const navItems = [
  { to: "/", label: "Documentos", icon: FolderOpen },
  { to: "/holerites", label: "Holerites", icon: FileText },
  { to: "/templates", label: "Modelos", icon: LayoutGrid },
  { to: "/settings", label: "Configuracoes", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#fffaf0] text-stone-900">
      <aside className="flex w-64 flex-col border-r border-[#f0dfac] bg-[#fffdf7]">
        <div className="border-b border-[#f7e8bc] px-5 py-5">
          <Link to="/" className="block">
            <PhSignLogo className="h-14 w-auto" />
            <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Plataforma de assinatura digital
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/" ||
                  location.pathname.startsWith("/documents")
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#fff3c7] text-[#111111] shadow-[inset_0_0_0_1px_rgba(255,184,28,0.24)]"
                    : "text-stone-600 hover:bg-[#fff6dc] hover:text-stone-900"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className="pb-1.5 pt-5">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Admin
                </div>
              </div>
              <Link
                to="/users"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === "/users"
                    ? "bg-[#fff3c7] text-[#111111] shadow-[inset_0_0_0_1px_rgba(255,184,28,0.24)]"
                    : "text-stone-600 hover:bg-[#fff6dc] hover:text-stone-900"
                }`}
              >
                <Users size={18} />
                Usuarios
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-[#f7e8bc] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#fff6dc]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0b7] text-xs font-bold text-[#141414]">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-stone-900">
                {user?.full_name}
              </div>
              <div className="truncate text-[11px] text-stone-400">
                {user?.email}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-stone-400 transition-colors hover:text-red-500"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#f0dfac] bg-white/85 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-stone-400">
              Uptech Sign Workspace
            </div>
            <Link
              to="/documents/new"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ffd92a] to-[#ff9a16] px-4 py-2 text-sm font-semibold text-[#111111] shadow-[0_14px_30px_rgba(255,178,22,0.26)] transition-opacity hover:opacity-95"
            >
              <Plus size={16} />
              Criar documento
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-texture">{children}</main>
      </div>
    </div>
  );
}
