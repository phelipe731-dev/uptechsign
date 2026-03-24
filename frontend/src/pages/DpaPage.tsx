import { useQuery } from "@tanstack/react-query";
import LegalLayout, { LegalSection } from "../components/legal/LegalLayout";
import { getPublicProfile } from "../services/settings";

export default function DpaPage() {
  const { data } = useQuery({
    queryKey: ["public-profile"],
    queryFn: getPublicProfile,
    staleTime: 5 * 60 * 1000,
  });

  const entity = data?.legal_entity_name || "Uptech Sign";
  const dpaEmail = data?.dpa_contact_email || data?.privacy_contact_email || data?.support_email || "-";

  return (
    <LegalLayout
      title="Resumo de tratamento de dados / DPA"
      subtitle="Material base para negociacao comercial e adequacao contratual"
    >
      <LegalSection title="1. Objeto">
        <p>
          Este resumo descreve como a plataforma trata dados pessoais dentro do fluxo de assinatura
          eletronica, podendo servir como base para um acordo de tratamento de dados entre a
          instituicao contratante e o fornecedor da tecnologia.
        </p>
      </LegalSection>

      <LegalSection title="2. Papel das partes">
        <p>
          Em regra, a instituicao contratante define os documentos, signatarios e finalidades do
          fluxo, enquanto a plataforma presta servicos de hospedagem, processamento, envio,
          armazenamento, verificacao e auditoria. A alocacao final de papeis deve ser fechada no
          contrato comercial aplicavel ao cliente.
        </p>
      </LegalSection>

      <LegalSection title="3. Categorias de dados e operacoes">
        <p>
          O tratamento pode abranger dados cadastrais, dados de contato, metadados de autenticacao,
          registros de uso, hashes de integridade, arquivos PDF/DOCX, trilha de auditoria e
          evidencias de assinatura.
        </p>
      </LegalSection>

      <LegalSection title="4. Medidas tecnicas e organizacionais">
        <p>
          A plataforma conta com autenticacao, trilha de auditoria, versionamento de arquivos,
          backup, monitoramento, restricao de acesso, suporte a HTTPS, configuracao de SMTP real,
          mascaramento de dados na verificacao publica e selagem institucional opcional do PDF
          final com certificado A1.
        </p>
      </LegalSection>

      <LegalSection title="5. Suboperadores e infraestrutura">
        <p>
          O uso de provedores de hospedagem, banco de dados, e-mail transacional, proxy e outras
          camadas de infraestrutura deve ser refletido no contrato comercial definitivo e nas
          politicas de seguranca adotadas pela operacao do cliente.
        </p>
      </LegalSection>

      <LegalSection title="6. Canal para diligencias de privacidade e DPA">
        <p>
          Solicitações relacionadas a due diligence, DPA, aditivos de tratamento ou revisoes de
          seguranca podem ser encaminhadas para {dpaEmail}.
        </p>
        <p className="mt-3">
          Parte responsavel atualmente identificada na plataforma: <strong>{entity}</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
