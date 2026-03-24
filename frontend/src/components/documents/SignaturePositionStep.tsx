import SignatureFieldEditor from "./SignatureFieldEditor";
import type { SignatureField } from "../../types";
import type { SignatoryInfo } from "../../services/signatures";

interface SignaturePositionStepProps {
  documentId: string;
  pdfFileId: string;
  signatories: SignatoryInfo[];
  fields: SignatureField[];
  onChanged: () => void;
}

export default function SignaturePositionStep({
  documentId,
  pdfFileId,
  signatories,
  fields,
  onChanged,
}: SignaturePositionStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900">4. Posicionar assinaturas</h3>
        <p className="text-sm text-gray-500 mt-1">
          Insira campos de assinatura, visto e texto no PDF. Se preferir, voce pode continuar sem
          posicionar campos.
        </p>
      </div>

      <SignatureFieldEditor
        documentId={documentId}
        pdfFileId={pdfFileId}
        signatories={signatories}
        fields={fields}
        onChanged={onChanged}
      />
    </div>
  );
}
