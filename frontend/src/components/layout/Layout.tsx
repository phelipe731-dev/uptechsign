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
    <div className="flex h-screen bg-[#F7F9FC] text-[#4A5568]">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-[#E6EAF0] bg-white">
        <div className="border-b border-[#E6EAF0] px-5 py-5">
          <Link to="/" className="block">
            <PhSignLogo className="h-14 w-auto" />
            <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#A0AEC0]">
              Plataforma de assinatura digital
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#FFF7ED] text-[#F59E0B]"
                    : "text-[#4A5568] hover:bg-[#F1F5F9] hover:text-[#1A202C]"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className="pb-1.5 pt-6">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#A0AEC0]">
                  Admin
                </div>
              </div>
              <Link
                to="/users"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === "/users"
                    ? "bg-[#FFF7ED] text-[#F59E0B]"
                    : "text-[#4A5568] hover:bg-[#F1F5F9] hover:text-[#1A202C]"
                }`}
              >
                <Users size={18} />
                Usuarios
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-[#E6EAF0] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[#F1F5F9]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-xs font-bold text-[#F59E0B]">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#1A202C]">
                {user?.full_name}
              </div>
              <div className="truncate text-[11px] text-[#A0AEC0]">
                {user?.email}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-[#A0AEC0] transition-colors hover:text-[#EF4444]"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#E6EAF0] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-[#A0AEC0]">
              Uptech Sign Workspace
            </div>
            <Link
              to="/documents/new"
              className="flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D97706]"
            >
              <Plus size={16} />
              Criar documento
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F7F9FC]">{children}</main>
      </div>
    </div>
  );
}
