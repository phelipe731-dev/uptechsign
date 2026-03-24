import { Send, Shield, LayoutTemplate, UserRound } from "lucide-react";
import type { SignatureField } from "../../types";
import type { Document } from "../../types";
import type { SignatoryInfo } from "../../services/signatures";

interface SendDocumentStepProps {
  document: Document;
  signatories: SignatoryInfo[];
  fields: SignatureField[];
  sending: boolean;
  error: string | null;
  onSend: () => void;
}

export default function SendDocumentStep({
  document,
  signatories,
  fields,
  sending,
  error,
  onSend,
}: SendDocumentStepProps) {
  const otpCount = signatories.filter((signatory) => signatory.auth_require_email_otp).length;
  const cpfCount = signatories.filter((signatory) => signatory.auth_require_cpf).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900">5. Enviar documento</h3>
        <p className="text-sm text-gray-500 mt-1">
          Revise o resumo final e dispare os links individuais de assinatura.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          icon={<UserRound size={18} />}
          title="Signatarios"
          value={`${signatories.length}`}
          detail={`${signatories.filter((signatory) => signatory.signing_order > 0).length} com ordem definida`}
        />
        <SummaryCard
          icon={<Shield size={18} />}
          title="Autenticacao"
          value={`${otpCount} OTP`}
          detail={`${cpfCount} validacoes por CPF`}
        />
        <SummaryCard
          icon={<LayoutTemplate size={18} />}
          title="Campos"
          value={`${fields.length}`}
          detail={`${fields.filter((field) => field.field_type === "text").length} texto(s) configurado(s)`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <div className="text-sm font-medium text-gray-900">{document.title}</div>
          <div className="text-sm text-gray-500 mt-1">
            Assim que enviado, o documento muda de rascunho para fluxo ativo de assinatura.
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSend}
            disabled={sending || signatories.length === 0}
            className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Send size={18} />
            {sending ? "Enviando..." : "Confirmar e enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-4 text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-2 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

