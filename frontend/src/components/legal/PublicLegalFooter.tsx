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
      className={`rounded-[10px] border border-[#E6EAF0] bg-white text-[#4A5568] ${
        compact ? "px-4 py-4" : "px-6 py-5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#000]">
            <ShieldCheck size={16} className="text-[#F59E0B]" />
            {appName}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#4A5568]">
            Suporte, privacidade e documentos legais da plataforma.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#F7F9FC] px-3 py-1.5 text-xs font-medium text-[#4A5568] transition-colors hover:bg-[#E6EAF0]"
          >
            Termos
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#F7F9FC] px-3 py-1.5 text-xs font-medium text-[#4A5568] transition-colors hover:bg-[#E6EAF0]"
          >
            Privacidade
          </a>
          <a
            href="/dpa"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#F7F9FC] px-3 py-1.5 text-xs font-medium text-[#4A5568] transition-colors hover:bg-[#E6EAF0]"
          >
            DPA
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoItem
          icon={<Headset size={15} className="text-[#F59E0B]" />}
          label="Canal de suporte"
          value={
            supportUrl ? (
              <a href={supportUrl} target="_blank" rel="noreferrer" className="text-[#F59E0B] hover:text-[#D97706]">
                {supportUrl}
              </a>
            ) : (
              "Nao configurado"
            )
          }
        />
        <InfoItem
          icon={<Mail size={15} className="text-[#F59E0B]" />}
          label="Suporte por e-mail"
          value={
            supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="text-[#F59E0B] hover:text-[#D97706]">
                {supportEmail}
              </a>
            ) : (
              "Nao configurado"
            )
          }
        />
        <InfoItem
          icon={<MessageCircle size={15} className="text-[#F59E0B]" />}
          label="Contato LGPD / DPA"
          value={
            privacyEmail ? (
              <a href={`mailto:${privacyEmail}`} className="text-[#F59E0B] hover:text-[#D97706]">
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
    <div className="rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#A0AEC0]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm text-[#4A5568] break-words">{value}</div>
    </div>
  );
}
