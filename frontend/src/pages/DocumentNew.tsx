import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DocumentWizard from "../components/documents/DocumentWizard";

export default function DocumentNew() {
  return (
    <div className="p-6">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        Documentos
      </Link>

      <DocumentWizard />
    </div>
  );
}
