import { Trash2 } from "lucide-react";
import type { TemplateField } from "../../types";

interface FieldMapperProps {
  fields: TemplateField[];
  onChange: (fields: TemplateField[]) => void;
}

export default function FieldMapper({ fields, onChange }: FieldMapperProps) {
  function update(index: number, patch: Partial<TemplateField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...fields];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next.map((f, i) => ({ ...f, display_order: i + 1 })));
  }

  function moveDown(index: number) {
    if (index === fields.length - 1) return;
    const next = [...fields];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next.map((f, i) => ({ ...f, display_order: i + 1 })));
  }

  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-4 text-center">
        Nenhum campo detectado. Verifique se o arquivo DOCX contÃ©m campos no formato [CAMPO].
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Placeholder no DOCX
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Chave (key)
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
              ObrigatÃ³rio
            </th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 leading-none text-xs"
                  >
                    â–²
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === fields.length - 1}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 leading-none text-xs"
                  >
                    â–¼
                  </button>
                </div>
              </td>
              <td className="py-2 px-3">
                <span className="font-mono text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                  [{field.label}]
                </span>
              </td>
              <td className="py-2 px-3">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => update(index, { key: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-900 text-sm font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  placeholder="campo_chave"
                />
              </td>
              <td className="py-2 px-3 text-center">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => update(index, { required: e.target.checked })}
                  className="w-4 h-4 accent-orange-600 cursor-pointer"
                />
              </td>
              <td className="py-2 px-3">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

