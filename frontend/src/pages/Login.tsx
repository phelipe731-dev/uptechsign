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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff5b8,transparent_36%),linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex rounded-[28px] border border-white/80 bg-white/80 px-6 py-5 shadow-[0_24px_60px_rgba(23,20,18,0.08)] backdrop-blur">
            <PhSignLogo className="h-16 w-auto" />
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
            Plataforma de assinatura digital
          </p>
        </div>

        <div className="brand-panel rounded-[28px] p-8">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Entrar</h2>
          <p className="mb-6 text-sm text-stone-500">
            Acesse seu ambiente para gerar, enviar e validar documentos.
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#e6d7a4] bg-white px-4 py-3 text-stone-900 placeholder-stone-400 transition-colors focus:border-[#ffb31b] focus:outline-none focus:ring-2 focus:ring-[#fff0b8]"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#e6d7a4] bg-white px-4 py-3 text-stone-900 placeholder-stone-400 transition-colors focus:border-[#ffb31b] focus:outline-none focus:ring-2 focus:ring-[#fff0b8]"
                placeholder="********"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginPending}
              className="w-full rounded-xl bg-gradient-to-r from-[#ffd92a] to-[#ff9a16] py-3 font-semibold text-[#111111] shadow-[0_18px_30px_rgba(255,178,22,0.22)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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
