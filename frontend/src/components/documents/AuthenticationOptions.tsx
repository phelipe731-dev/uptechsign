import { Shield, Save } from "lucide-react";
import { useState } from "react";
import {
  updateSignatory,
  type SignatoryData,
  type SignatoryInfo,
} from "../../services/signatures";

interface AuthenticationOptionsProps {
  signatories: SignatoryInfo[];
  onChanged: () => void;
}

export default function AuthenticationOptions({
  signatories,
  onChanged,
}: AuthenticationOptionsProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(signatoryId: string, payload: Partial<SignatoryData>) {
    setBusyId(signatoryId);
    setError(null);
    try {
      await updateSignatory(signatoryId, payload);
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">3. Configurar autenticacao</h3>
            <p className="text-sm text-gray-500 mt-1">
              Revise os requisitos de verificacao para cada signatario antes do envio.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {signatories.map((signatory) => (
          <div key={signatory.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900">{signatory.name}</div>
                <div className="text-sm text-gray-500 mt-1">{signatory.email}</div>
              </div>
              <div className="text-xs text-gray-400">
                {signatory.signing_order ? `Ordem ${signatory.signing_order}` : "Ordem livre"}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3 mt-4">
              <CheckboxCard
                title="OTP por email"
                description="Envia codigo de verificacao para o email do signatario."
                checked={signatory.auth_require_email_otp}
                disabled={busyId === signatory.id}
                onChange={(checked) =>
                  void handleToggle(signatory.id, {
                    auth_require_email_otp: checked,
                    auth_method: checked ? "otp_email" : "none",
                  })
                }
              />
              <CheckboxCard
                title="Nome completo"
                description="Exige confirmacao nominal antes de liberar a assinatura."
                checked={signatory.auth_require_full_name}
                disabled={busyId === signatory.id}
                onChange={(checked) =>
                  void handleToggle(signatory.id, {
                    auth_require_full_name: checked,
                  })
                }
              />
              <CheckboxCard
                title="Validar CPF"
                description="Confere o CPF digitado com o cadastro do signatario."
                checked={signatory.auth_require_cpf}
                disabled={busyId === signatory.id}
                onChange={(checked) =>
                  void handleToggle(signatory.id, {
                    auth_require_cpf: checked,
                  })
                }
              />
            </div>

            {busyId === signatory.id && (
              <div className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                <Save size={12} />
                Salvando configuracao...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckboxCard({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-800">{title}</div>
          <div className="text-xs text-gray-500 mt-1">{description}</div>
        </div>
      </div>
    </label>
  );
}

function extractApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as {
      response?: {
        data?: {
          detail?:
            | string
            | Array<{
                msg?: string;
              }>;
        };
      };
    }).response;
    const detail = response?.data?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg ?? "Erro inesperado.";
    }
    return typeof detail === "string" ? detail : "Erro inesperado.";
  }
  return "Erro inesperado.";
}

