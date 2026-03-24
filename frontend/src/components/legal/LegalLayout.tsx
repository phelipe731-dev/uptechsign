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
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="border-b border-[#E6EAF0] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-sm text-[#4A5568] transition-colors hover:text-[#1A202C]"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="rounded-[10px] border border-[#E6EAF0] bg-white p-8">
          <h1 className="text-2xl font-bold text-[#000]">{title}</h1>
          <p className="mt-2 text-sm text-[#4A5568]">{subtitle}</p>
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
      <h2 className="text-base font-semibold text-[#000]">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-[#4A5568]">{children}</div>
    </section>
  );
}
