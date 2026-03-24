import { useState } from "react";
import { AxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import PhSignLogo from "../components/branding/PhSignLogo";
import PublicLegalFooter from "../components/legal/PublicLegalFooter";

export default function Login() {
  const { login, loginPending, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const errorMessage =
    loginError instanceof AxiosError
      ? loginError.response?.data?.detail ?? "Erro ao fazer login."
      : loginError
        ? "Erro ao fazer login."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex rounded-xl border border-[#E6EAF0] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <PhSignLogo className="h-16 w-auto" />
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#A0AEC0]">
            Plataforma de assinatura digital
          </p>
        </div>

        <div className="rounded-xl border border-[#E6EAF0] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-2 text-lg font-semibold text-[#000]">Entrar</h2>
          <p className="mb-6 text-sm text-[#4A5568]">
            Acesse seu ambiente para gerar, enviar e validar documentos.
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await login({ email, password });
            }}
            className="space-y-5"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A202C]">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] transition-colors focus:border-[#F59E0B] focus:outline-none focus:ring-2 focus:ring-[#FFF7ED]"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1A202C]">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] transition-colors focus:border-[#F59E0B] focus:outline-none focus:ring-2 focus:ring-[#FFF7ED]"
                placeholder="********"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginPending}
              className="w-full rounded-lg bg-[#F59E0B] py-3 font-semibold text-white transition-colors hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginPending ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <PublicLegalFooter compact />
        </div>
      </div>
    </div>
  );
}
