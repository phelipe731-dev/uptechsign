import { useQuery } from "@tanstack/react-query";
import { Headset, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { getPublicProfile } from "../../services/settings";

export default function PublicLegalFooter({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["public-profile"],
    queryFn: getPublicProfile,
    staleTime: 5 * 60 * 1000,
  });

  const appName = data?.app_name || "Uptech Sign";
  const supportEmail = data?.support_email || "";
  const supportWhatsapp = data?.support_whatsapp || "";
  const supportUrl = data?.support_url || "";
  const privacyEmail = data?.privacy_contact_email || supportEmail;

  return (
    <div
      className={`rounded-2xl border border-[#f0dfac] bg-white/85 text-stone-600 shadow-sm ${
        compact ? "px-4 py-4" : "px-6 py-5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <ShieldCheck size={16} className="text-orange-500" />
            {appName}
          </div>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Suporte, privacidade e documentos legais da plataforma.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#fff6dc] px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-[#fff0c2]"
          >
            Termos
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#fff6dc] px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-[#fff0c2]"
          >
            Privacidade
          </a>
          <a
            href="/dpa"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#fff6dc] px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-[#fff0c2]"
          >
            DPA
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoItem
          icon={<Headset size={15} className="text-orange-500" />}
          label="Canal de suporte"
          value={
            supportUrl ? (
              <a href={supportUrl} target="_blank" rel="noreferrer" className="text-orange-600 hover:text-orange-700">
                {supportUrl}
              </a>
            ) : (
              "Nao configurado"
            )
          }
        />
        <InfoItem
          icon={<Mail size={15} className="text-orange-500" />}
          label="Suporte por e-mail"
          value={
            supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="text-orange-600 hover:text-orange-700">
                {supportEmail}
              </a>
            ) : (
              "Nao configurado"
            )
          }
        />
        <InfoItem
          icon={<MessageCircle size={15} className="text-orange-500" />}
          label="Contato LGPD / DPA"
          value={
            privacyEmail ? (
              <a href={`mailto:${privacyEmail}`} className="text-orange-600 hover:text-orange-700">
                {privacyEmail}
              </a>
            ) : (
              supportWhatsapp || "Nao configurado"
            )
          }
        />
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#f4e6ba] bg-[#fffdf7] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm text-stone-700 break-words">{value}</div>
    </div>
  );
}
