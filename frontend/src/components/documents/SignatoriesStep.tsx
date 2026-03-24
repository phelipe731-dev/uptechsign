import SignatoryManager from "./SignatoryManager";
import type { SignatoryInfo } from "../../services/signatures";

interface SignatoriesStepProps {
  documentId: string;
  signatories: SignatoryInfo[];
  onChanged: () => void;
}

export default function SignatoriesStep({
  documentId,
  signatories,
  onChanged,
}: SignatoriesStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900">2. Adicionar signatarios</h3>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre quem vai assinar, a ordem de assinatura e os dados de contato.
        </p>
      </div>

      <SignatoryManager documentId={documentId} signatories={signatories} onChanged={onChanged} />
    </div>
  );
}
