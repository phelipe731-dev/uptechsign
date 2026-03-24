import { useQuery } from "@tanstack/react-query";
import LegalLayout, { LegalSection } from "../components/legal/LegalLayout";
import { getPublicProfile } from "../services/settings";

export default function PrivacyPage() {
  const { data } = useQuery({
    queryKey: ["public-profile"],
    queryFn: getPublicProfile,
    staleTime: 5 * 60 * 1000,
  });

  const entity = data?.legal_entity_name || "a instituicao responsavel pelo envio do documento";
  const privacyEmail = data?.privacy_contact_email || data?.support_email || "o canal informado pela instituicao";

  return (
    <LegalLayout
      title="Politica de privacidade"
      subtitle="Tratamento de dados pessoais para criacao, envio, assinatura e verificacao de documentos"
    >
      <LegalSection title="1. Quem trata os dados">
        <p>
          {entity} utiliza esta plataforma para operacionalizar fluxos de assinatura, gestao
          documental e auditoria, atuando dentro do contexto contratual e operacional definido com
          seus usuarios e clientes.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados pessoais tratados">
        <p>
          Podem ser tratados nome, CPF, e-mail, telefone, IP, identificadores tecnicos,
          navegador, logs de acesso, dados do documento, hashes, evidencias de autenticacao e
          informacoes necessarias para conclusao, verificacao e defesa do fluxo de assinatura.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalidades do tratamento">
        <p>
          Os dados sao utilizados para execucao do servico, autenticacao do signatario,
          prevencao a fraude, preservacao da integridade documental, suporte tecnico, observancia
          de obrigacoes legais e exercicio regular de direitos.
        </p>
      </LegalSection>

      <LegalSection title="4. Compartilhamento e acesso">
        <p>
          O compartilhamento ocorre dentro do necessario para armazenamento, envio de e-mails,
          assinatura institucional do PDF, verificacao publica do documento e atendimento de
          obrigacoes legais. A consulta publica exibe dados minimizados, com mascaramento de
          informacoes pessoais sensiveis.
        </p>
      </LegalSection>

      <LegalSection title="5. Retencao e seguranca">
        <p>
          Documentos, evidencias e registros de auditoria podem ser mantidos pelo prazo necessario
          ao cumprimento contratual, suporte, defesa em disputas e observancia de obrigacoes
          legais. O acesso integral aos dados e restrito a perfis autorizados, com rotinas de
          backup, monitoramento e controle operacional.
        </p>
      </LegalSection>

      <LegalSection title="6. Direitos do titular e canal de privacidade">
        <p>
          Solicitacoes relacionadas a correcao, confirmacao de tratamento, esclarecimentos de
          privacidade ou exercicio de direitos devem ser encaminhadas para {privacyEmail}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
