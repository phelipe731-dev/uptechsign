import { useQuery } from "@tanstack/react-query";
import LegalLayout, { LegalSection } from "../components/legal/LegalLayout";
import { getPublicProfile } from "../services/settings";

export default function TermsPage() {
  const { data } = useQuery({
    queryKey: ["public-profile"],
    queryFn: getPublicProfile,
    staleTime: 5 * 60 * 1000,
  });

  const entity = data?.legal_entity_name || "a instituicao responsavel pelo envio do documento";
  const supportEmail = data?.support_email || "o canal de suporte informado no convite";

  return (
    <LegalLayout
      title="Termos de uso da assinatura eletronica"
      subtitle={`Versao ${data?.legal_terms_version || "2026-03-24"}`}
    >
      <LegalSection title="1. Escopo do servico">
        <p>
          Esta plataforma permite gerar, disponibilizar, assinar, verificar e arquivar documentos
          eletronicamente, com trilhas de autenticacao, integridade e auditoria.
        </p>
      </LegalSection>

      <LegalSection title="2. Manifestacao de vontade e aceite">
        <p>
          Ao prosseguir com a assinatura, o signatario declara que leu o documento, compreendeu seu
          conteudo e manifesta sua vontade por meio eletronico, utilizando os mecanismos de
          autenticacao disponibilizados no fluxo.
        </p>
      </LegalSection>

      <LegalSection title="3. Autenticacao e evidencias">
        <p>
          O fluxo pode incluir link individual, confirmacao de identidade, codigo OTP, aceite
          expresso, registro de IP, data e hora, navegador, dispositivo, hash do documento e
          outras evidencias tecnicas voltadas a autoria, integridade e auditabilidade.
        </p>
      </LegalSection>

      <LegalSection title="4. Integridade documental">
        <p>
          O documento final pode ser protegido por hash criptografico, trilha de auditoria
          encadeada e, quando configurado, assinatura institucional do PDF com certificado digital
          A1. Esses mecanismos reforcam a verificabilidade do arquivo final, sem substituir
          necessariamente a assinatura qualificada do signatario.
        </p>
      </LegalSection>

      <LegalSection title="5. Responsabilidades do signatario">
        <p>
          O signatario deve manter seguro o acesso ao seu e-mail, telefone e dispositivo. O uso
          indevido desses meios por terceiros fora do controle da plataforma pode comprometer a
          seguranca do fluxo e devera ser comunicado imediatamente.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilidades da plataforma">
        <p>
          {entity} opera a plataforma para disponibilizacao do fluxo de assinatura, mantendo
          mecanismos razoaveis de seguranca, integridade, monitoramento, backup e registro de
          eventos. A plataforma nao substitui analise juridica do conteudo do documento e nao
          garante automaticamente adequacao material do instrumento para cada caso concreto.
        </p>
      </LegalSection>

      <LegalSection title="7. Suporte e contatos">
        <p>
          Dificuldades operacionais, duvidas sobre o fluxo ou solicitacoes relacionadas ao uso da
          plataforma devem ser encaminhadas para {supportEmail}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
