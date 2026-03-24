import { ArrowLeft } from "lucide-react";
import PublicLegalFooter from "./PublicLegalFooter";

export default function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5b8,transparent_36%),linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)]">
      <div className="border-b border-[#f0dfac] bg-white/88 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="rounded-[28px] border border-[#f0dfac] bg-white p-8 shadow-[0_24px_60px_rgba(23,20,18,0.06)]">
          <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
          <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
          <div className="mt-8 space-y-6">{children}</div>
        </div>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-stone-600">{children}</div>
    </section>
  );
}
