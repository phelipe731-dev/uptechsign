import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { CheckCircle, XCircle, Shield, Mail, Type, PenTool } from "lucide-react";
import { getMe, refreshToken } from "../services/auth";
import {
  confirmIdentity,
  getSigningInfo,
  requestOtp,
  verifyOtp,
  submitSignature,
  refuseSignature,
} from "../services/signatures";
import type { PublicDocumentInfo } from "../services/signatures";
import type { UserSignatureData } from "../types";
import PublicSigningPdfViewer from "../components/signatures/PublicSigningPdfViewer";
import SignaturePad from "../components/signatures/SignaturePad";
import SelfieCapture from "../components/signatures/SelfieCapture";
import PhSignLogo from "../components/branding/PhSignLogo";
import PublicLegalFooter from "../components/legal/PublicLegalFooter";

type Step =
  | "loading"
  | "identity"
  | "otp_intro"
  | "otp"
  | "sign"
  | "done"
  | "refused"
  | "error";

type SignatureMode = "drawn" | "typed";

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [info, setInfo] = useState<PublicDocumentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState("");

  const [identityFullName, setIdentityFullName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityCpf, setIdentityCpf] = useState("");
  const [identityPhoneCountryCode, setIdentityPhoneCountryCode] = useState("+55");
  const [identityPhoneNumber, setIdentityPhoneNumber] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState("");
  const [debugOtpCode, setDebugOtpCode] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [typedName, setTypedName] = useState("");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("drawn");
  const [signatureImage, setSignatureImage] = useState("");
  const [selfieImage, setSelfieImage] = useState("");
  const [savedSignature, setSavedSignature] = useState<UserSignatureData | null>(null);
  const [publicFieldValues, setPublicFieldValues] = useState<Record<string, string>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [signLoading, setSignLoading] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const [showRefuse, setShowRefuse] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [refuseLoading, setRefuseLoading] = useState(false);

  const missingRequiredTextField = info?.fields
    .filter((field) => field.field_type === "text" && field.required)
    .some((field) => !(publicFieldValues[field.id] ?? "").trim());

  useEffect(() => {
    if (!token) return;
    void loadInfo();
  }, [token]);

  useEffect(() => {
    void loadSavedSignature();
  }, []);

  useEffect(() => {
    if (!info) return;
    const nextValues: Record<string, string> = {};
    for (const field of info.fields) {
      nextValues[field.id] = field.value ?? "";
    }
    setPublicFieldValues(nextValues);
  }, [info]);

  async function loadInfo() {
    try {
      const data = await getSigningInfo(token!);
      setInfo(data);
      setIdentityFullName((current) => current || data.signatory_name);
      setTypedName((current) => current || data.signatory_name);

      if (data.status === "otp_verified") {
        setStep("sign");
        return;
      }

      if (data.identity_confirmed) {
        setStep(data.requires_otp ? "otp_intro" : "sign");
        return;
      }

      setStep("identity");
    } catch (err: unknown) {
      setError(extractError(err));
      setStep("error");
    }
  }

  async function loadSavedSignature() {
    try {
      await refreshToken();
      const me = await getMe();
      setSavedSignature(me.signature_data ?? null);
    } catch {
      setSavedSignature(null);
    }
  }

  async function handleConfirmIdentity() {
    setIdentityLoading(true);
    setIdentityError(null);

    try {
      const response = await confirmIdentity(token!, {
        full_name: identityFullName.trim(),
        email: identityEmail.trim(),
        cpf: identityCpf.trim() || undefined,
        phone_country_code: identityPhoneCountryCode.trim() || undefined,
        phone_number: identityPhoneNumber.trim() || undefined,
      });

      setInfo((current) =>
        current
          ? {
              ...current,
              identity_confirmed: true,
            }
          : current
      );
      setTypedName(identityFullName.trim());
      setStep(response.requires_otp ? "otp_intro" : "sign");
    } catch (err: unknown) {
      setIdentityError(extractError(err));
    } finally {
      setIdentityLoading(false);
    }
  }

  async function handleRequestOtp() {
    setOtpLoading(true);
    setOtpError(null);

    try {
      const response = await requestOtp(token!);
      setEmailHint(response.email_hint);
      setDebugOtpCode(response.debug_code ?? null);
      setStep("otp");
    } catch (err: unknown) {
      setOtpError(extractError(err));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true);
    setOtpError(null);

    try {
      await verifyOtp(token!, otpCode);
      setStep("sign");
    } catch (err: unknown) {
      setOtpError(extractError(err));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSign() {
    if (!typedName.trim()) return;
    if (signatureMode === "drawn" && !signatureImage) return;

    setSignLoading(true);
    setSignError(null);

    try {
      const base64 =
        signatureMode === "drawn"
          ? signatureImage.includes(",")
            ? signatureImage.split(",")[1]
            : signatureImage
          : undefined;
      const selfieBase64 = selfieImage
        ? selfieImage.includes(",")
          ? selfieImage.split(",")[1]
          : selfieImage
        : undefined;

      await submitSignature(token!, {
        typed_name: typedName.trim(),
        signature_mode: signatureMode,
        signature_image_base64: base64,
        selfie_image_base64: selfieBase64,
        field_values: publicFieldValues,
        accept_terms: acceptTerms,
      });
      setStep("done");
    } catch (err: unknown) {
      setSignError(extractError(err));
    } finally {
      setSignLoading(false);
    }
  }

  async function handleRefuse() {
    setRefuseLoading(true);
    try {
      await refuseSignature(token!, refuseReason || undefined);
      setStep("refused");
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setRefuseLoading(false);
    }
  }

  function switchSignatureMode(mode: SignatureMode) {
    setSignatureMode(mode);
    if (mode === "typed") {
      setSignatureImage("");
    }
  }

  function applySavedSignature() {
    if (!savedSignature) return;
    const normalizedImage = normalizeSignatureImage(savedSignature.signature_image_base64);
    const preferredMode =
      savedSignature.default_mode === "drawn" && normalizedImage ? "drawn" : "typed";

    setTypedName(savedSignature.typed_name || typedName || info?.signatory_name || "");
    setSignatureMode(preferredMode);
    setSignatureImage(preferredMode === "drawn" ? normalizedImage : "");
  }

  if (step === "error") {
    return (
      <PageShell>
        <div className="text-center py-12">
          <XCircle size={48} className="mx-auto text-[#EF4444] mb-4" />
          <h2 className="text-xl font-bold text-[#000] mb-2">Link indisponivel</h2>
          <p className="text-[#4A5568] text-sm">{error}</p>
        </div>
      </PageShell>
    );
  }

  if (step === "loading" || !info) {
    return (
      <PageShell>
        <div className="text-center py-12 text-[#A0AEC0]">Carregando documento...</div>
      </PageShell>
    );
  }

  if (step === "done") {
    return (
      <PageShell>
        <div className="text-center py-12">
          <CheckCircle size={56} className="mx-auto text-[#22C55E] mb-4" />
          <h2 className="text-xl font-bold text-[#000] mb-2">Documento assinado</h2>
          <p className="text-[#4A5568] text-sm">
            Sua assinatura foi registrada com sucesso. Voce pode fechar esta pagina.
          </p>
        </div>
      </PageShell>
    );
  }

  if (step === "refused") {
    return (
      <PageShell>
        <div className="text-center py-12">
          <XCircle size={56} className="mx-auto text-[#EF4444] mb-4" />
          <h2 className="text-xl font-bold text-[#000] mb-2">Assinatura recusada</h2>
          <p className="text-[#4A5568] text-sm">
            Sua recusa foi registrada. Voce pode fechar esta pagina.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[#000]">{info.document_title}</h2>
        <p className="text-sm text-[#4A5568] mt-1">
          Solicitado para: <span className="text-[#1A202C]">{info.signatory_name}</span>
          {info.signatory_role && <span className="text-[#A0AEC0]"> / {info.signatory_role}</span>}
        </p>
        {info.fields.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {info.fields.map((field) => (
              <span
                key={field.id}
                className="px-2.5 py-1 rounded-full bg-[#F7F9FC] text-[#4A5568] text-xs"
              >
                Pag. {field.page} / {field.field_type === "signature"
                  ? "Assinatura"
                  : field.field_type === "initials"
                    ? "Visto"
                    : field.label || "Texto"}
                {field.required && " / obrigatorio"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <PublicSigningPdfViewer
          token={token!}
          signatoryName={info.signatory_name}
          fields={info.fields}
          values={publicFieldValues}
          onFieldValueChange={(fieldId, value) =>
            setPublicFieldValues((current) => ({
              ...current,
              [fieldId]: value,
            }))
          }
          typedName={typedName}
          signatureMode={signatureMode}
          signatureImage={signatureImage}
          editableTextFields={step === "sign"}
          showSignaturePreview={step === "sign"}
        />
      </div>

      {step === "identity" && (
        <div className="bg-white border border-[#E6EAF0] rounded-[10px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-[#F59E0B]" />
            <h3 className="font-semibold text-[#000]">Confirmacao de identidade</h3>
          </div>

          <p className="text-sm text-[#4A5568] mb-4">
            Confirme seus dados antes de prosseguir com a assinatura do documento.
          </p>

          {identityError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-[#EF4444] text-sm">
              {identityError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-[#1A202C] mb-2">Nome completo</span>
              <input
                type="text"
                value={identityFullName}
                onChange={(e) => setIdentityFullName(e.target.value)}
                className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-[#1A202C] mb-2">Email</span>
              <input
                type="email"
                value={identityEmail}
                onChange={(e) => setIdentityEmail(e.target.value)}
                placeholder="Digite o email destinatario"
                className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
              />
            </label>

            <div className="grid gap-3 grid-cols-[110px_1fr] md:col-span-2">
              <label className="block">
                <span className="block text-sm font-medium text-[#1A202C] mb-2">DDI</span>
                <input
                  type="text"
                  value={identityPhoneCountryCode}
                  onChange={(e) => setIdentityPhoneCountryCode(e.target.value)}
                  className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-[#1A202C] mb-2">
                  Telefone (opcional)
                </span>
                <input
                  type="text"
                  value={identityPhoneNumber}
                  onChange={(e) => setIdentityPhoneNumber(e.target.value)}
                  placeholder="11999999999"
                  className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
                />
              </label>
            </div>

            {info.require_cpf && (
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium text-[#1A202C] mb-2">CPF</span>
                <input
                  type="text"
                  value={identityCpf}
                  onChange={(e) => setIdentityCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
                />
              </label>
            )}
          </div>

          <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-lg px-4 py-3 mt-4 text-sm text-[#4A5568]">
            Ao continuar, seus dados de visualizacao, IP e dispositivo serao registrados para fins
            de auditoria e evidencias da assinatura.
          </div>

          <div className="flex items-center justify-between gap-3 mt-5">
            <button
              onClick={handleConfirmIdentity}
              disabled={identityLoading || !identityFullName.trim() || !identityEmail.trim()}
              className="flex items-center gap-2 bg-[#F59E0B] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#D97706] transition-colors disabled:opacity-50"
            >
              <Shield size={18} />
              {identityLoading ? "Confirmando..." : "Confirmar identidade"}
            </button>
          </div>

          <RefuseButton
            show={showRefuse}
            setShow={setShowRefuse}
            reason={refuseReason}
            setReason={setRefuseReason}
            loading={refuseLoading}
            onRefuse={handleRefuse}
          />
        </div>
      )}

      {step === "otp_intro" && (
        <div className="bg-white border border-[#E6EAF0] rounded-[10px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-[#F59E0B]" />
            <h3 className="font-semibold text-[#000]">Verificacao por OTP</h3>
          </div>

          <p className="text-sm text-[#4A5568] mb-4">
            Para concluir a assinatura, enviaremos um codigo de verificacao para o email cadastrado.
          </p>

          {otpError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-[#EF4444] text-sm">
              {otpError}
            </div>
          )}

          <button
            onClick={handleRequestOtp}
            disabled={otpLoading}
            className="flex items-center gap-2 bg-[#F59E0B] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#D97706] transition-colors disabled:opacity-50"
          >
            <Mail size={18} />
            {otpLoading ? "Enviando..." : "Enviar codigo"}
          </button>

          <RefuseButton
            show={showRefuse}
            setShow={setShowRefuse}
            reason={refuseReason}
            setReason={setRefuseReason}
            loading={refuseLoading}
            onRefuse={handleRefuse}
          />
        </div>
      )}

      {step === "otp" && (
        <div className="bg-white border border-[#E6EAF0] rounded-[10px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-[#F59E0B]" />
            <h3 className="font-semibold text-[#000]">Digite o codigo enviado</h3>
          </div>

          <p className="text-sm text-[#4A5568] mb-4">
            Enviamos um codigo de 6 digitos para{" "}
            <span className="text-[#1A202C]">{emailHint}</span>.
          </p>

          {debugOtpCode && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-[#FFF7ED] px-4 py-3 text-sm text-[#D97706]">
              Ambiente local sem SMTP: use o codigo{" "}
              <span className="font-mono font-semibold">{debugOtpCode}</span>.
            </div>
          )}

          {otpError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-[#EF4444] text-sm">
              {otpError}
            </div>
          )}

          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-40 bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-center text-xl tracking-[0.3em] text-[#1A202C] font-mono focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpCode.length !== 6}
              className="bg-[#F59E0B] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#D97706] transition-colors disabled:opacity-50"
            >
              {otpLoading ? "Verificando..." : "Validar codigo"}
            </button>
          </div>

          <button
            onClick={handleRequestOtp}
            disabled={otpLoading}
            className="text-sm text-[#A0AEC0] hover:text-[#F59E0B] transition-colors"
          >
            Reenviar codigo
          </button>

          <RefuseButton
            show={showRefuse}
            setShow={setShowRefuse}
            reason={refuseReason}
            setReason={setRefuseReason}
            loading={refuseLoading}
            onRefuse={handleRefuse}
          />
        </div>
      )}

      {step === "sign" && (
        <div className="bg-white border border-[#E6EAF0] rounded-[10px] p-6 space-y-5">
          <h3 className="font-semibold text-[#000]">Assinar documento</h3>

          {signError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-[#EF4444] text-sm">
              {signError}
            </div>
          )}

          {info.fields.some((field) => field.field_type === "text") && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                missingRequiredTextField
                  ? "border-amber-200 bg-[#FFF7ED] text-[#D97706]"
                  : "border-green-100 bg-green-50 text-[#22C55E]"
              }`}
            >
              {missingRequiredTextField
                ? "Preencha os campos obrigatorios destacados diretamente no PDF acima antes de concluir a assinatura."
                : "Os campos de texto deste documento sao preenchidos diretamente no PDF acima."}
            </div>
          )}

          {savedSignature && (
            <div className="rounded-lg border border-[#FFF7ED] bg-[#FFF7ED] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#D97706]">
                    Assinatura salva detectada neste navegador
                  </div>
                  <p className="mt-1 text-sm text-[#4A5568]">
                    Use a assinatura do seu perfil como atalho e revise antes de concluir.
                  </p>
                  {savedSignature.updated_at && (
                    <div className="mt-2 text-xs text-[#A0AEC0]">
                      Atualizada em{" "}
                      {new Date(savedSignature.updated_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applySavedSignature}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-white px-4 py-2 text-sm font-medium text-[#D97706] transition-colors hover:bg-[#FFF7ED]"
                >
                  Usar assinatura salva
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-lg border border-[#E6EAF0] bg-white px-4 py-3 text-sm text-[#1A202C]">
                  <div className="font-medium">
                    {savedSignature.typed_name || info.signatory_name}
                  </div>
                  <div className="mt-1 text-xs text-[#A0AEC0]">
                    Modo padrao:{" "}
                    {savedSignature.default_mode === "drawn" && savedSignature.signature_image_base64
                      ? "assinatura desenhada"
                      : "assinatura por texto"}
                  </div>
                  {savedSignature.initials && (
                    <div className="mt-1 text-xs text-[#A0AEC0]">
                      Iniciais salvas: {savedSignature.initials}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-[#E6EAF0] bg-white px-4 py-4">
                  {savedSignature.signature_image_base64 ? (
                    <img
                      src={normalizeSignatureImage(savedSignature.signature_image_base64)}
                      alt="Assinatura salva"
                      className="h-20 w-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-20 items-center justify-center text-center text-2xl text-[#1A202C]"
                      style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
                    >
                      {savedSignature.typed_name || info.signatory_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1A202C] mb-2">Nome da assinatura</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-3 text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#FFF7ED] transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSignatureMode("drawn")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                signatureMode === "drawn"
                  ? "border-[#F59E0B] bg-[#FFF7ED] text-[#D97706]"
                  : "border-[#E6EAF0] text-[#4A5568] hover:border-[#A0AEC0]"
              }`}
            >
              <PenTool size={16} />
              Assinatura desenhada
            </button>
            <button
              type="button"
              onClick={() => switchSignatureMode("typed")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                signatureMode === "typed"
                  ? "border-[#F59E0B] bg-[#FFF7ED] text-[#D97706]"
                  : "border-[#E6EAF0] text-[#4A5568] hover:border-[#A0AEC0]"
              }`}
            >
              <Type size={16} />
              Assinatura por texto
            </button>
          </div>

          {signatureMode === "drawn" ? (
            <SignaturePad
              onSignature={setSignatureImage}
              disabled={signLoading}
              initialValue={signatureImage}
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#1A202C]">Previa da assinatura</label>
              </div>
              <div className="border border-[#E6EAF0] rounded-lg px-6 py-10 bg-white">
                <div
                  className="text-center text-3xl text-[#1A202C]"
                  style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
                >
                  {typedName || "Seu nome aparecera aqui"}
                </div>
              </div>
              <p className="text-xs text-[#A0AEC0] mt-2">
                A assinatura por texto usa o nome informado acima como representacao visual.
              </p>
            </div>
          )}

          <SelfieCapture
            value={selfieImage}
            onChange={setSelfieImage}
            disabled={signLoading}
          />

          <div className="flex items-center justify-between pt-2">
            <div className="w-full space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-[#E6EAF0] bg-[#F7F9FC] px-4 py-3 text-sm text-[#4A5568]">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#E6EAF0] text-[#F59E0B] focus:ring-[#FFF7ED]"
                />
                <span>
                  {info.terms_summary} Isso ocorre nos termos da legislacao aplicavel e da versao{" "}
                  <span className="font-semibold">{info.terms_version}</span> dos{" "}
                  <Link to="/terms" target="_blank" rel="noreferrer" className="text-[#F59E0B] hover:text-[#D97706]">
                    Termos de Uso
                  </Link>{" "}
                  e da{" "}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className="text-[#F59E0B] hover:text-[#D97706]">
                    Politica de Privacidade
                  </Link>
                  .
                </span>
              </label>

              <button
                onClick={handleSign}
                disabled={
                  signLoading ||
                  !typedName.trim() ||
                  (signatureMode === "drawn" && !signatureImage) ||
                  missingRequiredTextField ||
                  !acceptTerms
                }
                className="flex items-center gap-2 bg-[#F59E0B] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#D97706] transition-colors disabled:opacity-50"
              >
                <CheckCircle size={18} />
                {signLoading ? "Assinando..." : "Assinar documento"}
              </button>
            </div>
          </div>

          <RefuseButton
            show={showRefuse}
            setShow={setShowRefuse}
            reason={refuseReason}
            setReason={setRefuseReason}
            loading={refuseLoading}
            onRefuse={handleRefuse}
          />
        </div>
      )}
    </PageShell>
  );
}

function normalizeSignatureImage(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <meta name="robots" content="noindex" />

      <div className="border-b border-[#E6EAF0] bg-white">
        <div className="h-1 bg-[#F59E0B]" />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <PhSignLogo className="h-12 w-auto" />
          <div className="text-right text-[11px] font-medium uppercase tracking-[0.2em] text-[#A0AEC0]">
            assinatura digital
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6 px-6 py-8">
        {children}
        <PublicLegalFooter compact />
      </div>
    </div>
  );
}

function RefuseButton({
  show,
  setShow,
  reason,
  setReason,
  loading,
  onRefuse,
}: {
  show: boolean;
  setShow: (value: boolean) => void;
  reason: string;
  setReason: (value: string) => void;
  loading: boolean;
  onRefuse: () => void;
}) {
  return (
    <div className="mt-6 pt-4 border-t border-[#F1F5F9]">
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="text-sm text-[#A0AEC0] hover:text-[#EF4444] transition-colors"
        >
          Recusar assinatura
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#4A5568]">
            Tem certeza que deseja recusar? Esta acao nao pode ser desfeita.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da recusa (opcional)"
            rows={2}
            className="w-full bg-white border border-[#E6EAF0] rounded-lg px-4 py-2 text-sm text-[#1A202C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#EF4444] focus:ring-2 focus:ring-red-50 transition-colors"
          />
          <div className="flex gap-3">
            <button
              onClick={onRefuse}
              disabled={loading}
              className="bg-[#EF4444] text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Recusando..." : "Confirmar recusa"}
            </button>
            <button
              onClick={() => setShow(false)}
              className="text-sm text-[#A0AEC0] hover:text-[#4A5568] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as {
      response?: {
        status?: number;
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
    if (typeof detail === "string") {
      return detail;
    }
    if (response?.status && response.status >= 500) {
      return "Nao foi possivel finalizar a assinatura agora. Tente novamente em alguns instantes.";
    }
    return "Erro inesperado.";
  }
  return "Erro de conexao.";
}
