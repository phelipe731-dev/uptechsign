import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  createSignatory,
  deleteSignatory,
  updateSignatory,
  type SignatoryData,
  type SignatoryInfo,
} from "../../services/signatures";

interface SignatoryManagerProps {
  documentId: string;
  signatories: SignatoryInfo[];
  disabled?: boolean;
  onChanged: () => void;
}

function createEmptySignatory(): SignatoryData {
  return {
    name: "",
    email: "",
    cpf: "",
    phone_country_code: "+55",
    phone_number: "",
    role_label: "",
    signing_order: 0,
    auth_require_email_otp: true,
    auth_require_full_name: true,
    auth_require_cpf: false,
  };
}

export default function SignatoryManager({
  documentId,
  signatories,
  disabled = false,
  onChanged,
}: SignatoryManagerProps) {
  const [drafts, setDrafts] = useState<Record<string, SignatoryData>>({});
  const [newSignatory, setNewSignatory] = useState<SignatoryData>(createEmptySignatory());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const nextDrafts: Record<string, SignatoryData> = {};
    for (const signatory of signatories) {
      nextDrafts[signatory.id] = {
        name: signatory.name,
        email: signatory.email,
        cpf: signatory.cpf ?? "",
        phone_country_code: signatory.phone_country_code ?? "+55",
        phone_number: signatory.phone_number ?? "",
        role_label: signatory.role_label ?? "",
        signing_order: signatory.signing_order,
        auth_method: signatory.auth_method,
        auth_require_email_otp: signatory.auth_require_email_otp,
        auth_require_full_name: signatory.auth_require_full_name,
        auth_require_cpf: signatory.auth_require_cpf,
      };
    }
    setDrafts(nextDrafts);
  }, [signatories]);

  function updateDraft(signatoryId: string, field: keyof SignatoryData, value: string | number | boolean) {
    setDrafts((current) => ({
      ...current,
      [signatoryId]: {
        ...current[signatoryId],
        [field]: value,
      },
    }));
  }

  function updateNew(field: keyof SignatoryData, value: string | number | boolean) {
    setNewSignatory((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      await createSignatory(documentId, newSignatory);
      setNewSignatory(createEmptySignatory());
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(signatoryId: string) {
    setBusyId(signatoryId);
    setError(null);
    try {
      await updateSignatory(signatoryId, drafts[signatoryId]);
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(signatoryId: string) {
    setBusyId(signatoryId);
    setError(null);
    try {
      await deleteSignatory(signatoryId);
      onChanged();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Signatarios</h2>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre os signatarios antes de posicionar os campos no PDF.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {signatories.map((signatory) => {
        const draft = drafts[signatory.id];
        if (!draft) return null;

        return (
          <SignatoryCard
            key={signatory.id}
            title={`Signatario ${signatory.name}`}
            data={draft}
            disabled={disabled || busyId === signatory.id}
            onChange={(field, value) => updateDraft(signatory.id, field, value)}
            onPrimaryAction={() => handleUpdate(signatory.id)}
            onSecondaryAction={() => handleDelete(signatory.id)}
            primaryLabel={busyId === signatory.id ? "Salvando..." : "Salvar"}
            secondaryLabel="Excluir"
            primaryIcon={<Save size={15} />}
            secondaryIcon={<Trash2 size={15} />}
          />
        );
      })}

      <SignatoryCard
        title="Novo signatario"
        data={newSignatory}
        disabled={disabled || creating}
        onChange={updateNew}
        onPrimaryAction={handleCreate}
        primaryLabel={creating ? "Adicionando..." : "Adicionar signatario"}
        primaryIcon={<Plus size={15} />}
      />
    </div>
  );
}

function SignatoryCard({
  title,
  data,
  disabled,
  onChange,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
  primaryIcon,
  secondaryIcon,
}: {
  title: string;
  data: SignatoryData;
  disabled: boolean;
  onChange: (field: keyof SignatoryData, value: string | number | boolean) => void;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  primaryIcon: React.ReactNode;
  secondaryIcon?: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60">
      <div className="text-sm font-medium text-gray-800 mb-4">{title}</div>

      <div className="grid gap-3 md:grid-cols-2">
        <InputField
          label="Nome completo"
          value={data.name ?? ""}
          disabled={disabled}
          onChange={(value) => onChange("name", value)}
        />
        <InputField
          label="Email"
          value={data.email ?? ""}
          type="email"
          disabled={disabled}
          onChange={(value) => onChange("email", value)}
        />
        <InputField
          label="CPF"
          value={data.cpf ?? ""}
          disabled={disabled}
          onChange={(value) => onChange("cpf", value)}
        />
        <InputField
          label="Papel"
          value={data.role_label ?? ""}
          disabled={disabled}
          onChange={(value) => onChange("role_label", value)}
        />

        <div className="grid gap-3 grid-cols-[110px_1fr] md:col-span-2">
          <InputField
            label="DDI"
            value={data.phone_country_code ?? ""}
            disabled={disabled}
            onChange={(value) => onChange("phone_country_code", value)}
          />
          <InputField
            label="Telefone"
            value={data.phone_number ?? ""}
            disabled={disabled}
            onChange={(value) => onChange("phone_number", value)}
          />
        </div>

        <InputField
          label="Ordem"
          value={String(data.signing_order ?? 0)}
          type="number"
          min={0}
          disabled={disabled}
          onChange={(value) => onChange("signing_order", Number(value) || 0)}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3 mt-4">
        <CheckboxField
          label="OTP por email"
          checked={data.auth_require_email_otp ?? true}
          disabled={disabled}
          onChange={(checked) => onChange("auth_require_email_otp", checked)}
        />
        <CheckboxField
          label="Exigir nome completo"
          checked={data.auth_require_full_name ?? true}
          disabled={disabled}
          onChange={(checked) => onChange("auth_require_full_name", checked)}
        />
        <CheckboxField
          label="Validar CPF"
          checked={data.auth_require_cpf ?? false}
          disabled={disabled}
          onChange={(checked) => onChange("auth_require_cpf", checked)}
        />
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={disabled || !data.name?.trim() || !data.email?.trim()}
          className="inline-flex items-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {primaryIcon}
          {primaryLabel}
        </button>
        {onSecondaryAction && secondaryLabel && (
          <button
            type="button"
            onClick={onSecondaryAction}
            disabled={disabled}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {secondaryIcon}
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-600 mb-1">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 disabled:opacity-60"
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
      />
      {label}
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

