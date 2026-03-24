import { useState } from "react";
import { AxiosError } from "axios";
import PhSignLogo from "../components/branding/PhSignLogo";
import PublicLegalFooter from "../components/legal/PublicLegalFooter";
import { useAuth } from "../hooks/useAuth";

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
    <div className="min-h-screen bg-[#F7F9FC] px-6 py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <div className="hidden lg:block">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FDE7B3] bg-[#FFF7ED] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#D97706]">
              Plataforma de assinatura digital
            </div>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#000000]">
              Operacao documental com cara de produto profissional.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#4A5568]">
              Gere documentos, acompanhe assinaturas e mantenha toda a trilha
              juridica em uma experiencia mais limpa, moderna e corporativa.
            </p>
          </div>

          <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
            <div className="rounded-[16px] border border-[#E6EAF0] bg-white p-5">
              <div className="text-sm font-semibold text-[#111827]">Fluxo visual</div>
              <div className="mt-2 text-sm leading-6 text-[#4A5568]">
                Criacao, envio e assinatura centralizados em um unico painel.
              </div>
            </div>
            <div className="rounded-[16px] border border-[#E6EAF0] bg-white p-5">
              <div className="text-sm font-semibold text-[#111827]">Auditoria forte</div>
              <div className="mt-2 text-sm leading-6 text-[#4A5568]">
                OTP, logs, evidencias, verificacao publica e historico rastreavel.
              </div>
            </div>
            <div className="rounded-[16px] border border-[#E6EAF0] bg-white p-5">
              <div className="text-sm font-semibold text-[#111827]">Visual UP TECH</div>
              <div className="mt-2 text-sm leading-6 text-[#4A5568]">
                Destaque em laranja, base limpa e linguagem corporativa moderna.
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="mb-8 text-center lg:hidden">
            <div className="inline-flex rounded-xl border border-[#E6EAF0] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <PhSignLogo className="h-16 w-auto" />
            </div>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#A0AEC0]">
              Plataforma de assinatura digital
            </p>
          </div>

          <div className="rounded-[18px] border border-[#E6EAF0] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-6">
              <PhSignLogo className="hidden h-14 w-auto lg:block" />
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#000]">
                Entrar no workspace
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4A5568]">
                Acesse seu ambiente para gerar, enviar e validar documentos com
                um layout mais clean e profissional.
              </p>
            </div>

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

            <div className="mt-6 rounded-2xl border border-[#E6EAF0] bg-[#FBFCFE] px-4 py-4 text-sm leading-6 text-[#4A5568]">
              Um visual mais organizado reduz ruido, melhora a leitura e deixa a
              plataforma com cara real de produto SaaS.
            </div>
          </div>

          <div className="mt-6">
            <PublicLegalFooter compact />
          </div>
        </div>
      </div>
    </div>
  );
}
