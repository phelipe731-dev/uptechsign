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

      await submitSignature(token!, {
        typed_name: typedName.trim(),
        signature_mode: signatureMode,
        signature_image_base64: base64,
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
          <XCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link indisponivel</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </PageShell>
    );
  }

  if (step === "loading" || !info) {
    return (
      <PageShell>
        <div className="text-center py-12 text-gray-400">Carregando documento...</div>
      </PageShell>
    );
  }

  if (step === "done") {
    return (
      <PageShell>
        <div className="text-center py-12">
          <CheckCircle size={56} className="mx-auto text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Documento assinado</h2>
          <p className="text-gray-500 text-sm">
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
          <XCircle size={56} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Assinatura recusada</h2>
          <p className="text-gray-500 text-sm">
            Sua recusa foi registrada. Voce pode fechar esta pagina.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">{info.document_title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Solicitado para: <span className="text-gray-700">{info.signatory_name}</span>
          {info.signatory_role && <span className="text-gray-400"> / {info.signatory_role}</span>}
        </p>
        {info.fields.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {info.fields.map((field) => (
              <span
                key={field.id}
                className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs"
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-orange-600" />
            <h3 className="font-semibold text-gray-900">Confirmacao de identidade</h3>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Confirme seus dados antes de prosseguir com a assinatura do documento.
          </p>

          {identityError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-red-700 text-sm">
              {identityError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Nome completo</span>
              <input
                type="text"
                value={identityFullName}
                onChange={(e) => setIdentityFullName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Email</span>
              <input
                type="email"
                value={identityEmail}
                onChange={(e) => setIdentityEmail(e.target.value)}
                placeholder="Digite o email destinatario"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </label>

            <div className="grid gap-3 grid-cols-[110px_1fr] md:col-span-2">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">DDI</span>
                <input
                  type="text"
                  value={identityPhoneCountryCode}
                  onChange={(e) => setIdentityPhoneCountryCode(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone (opcional)
                </span>
                <input
                  type="text"
                  value={identityPhoneNumber}
                  onChange={(e) => setIdentityPhoneNumber(e.target.value)}
                  placeholder="11999999999"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </label>
            </div>

            {info.require_cpf && (
              <label className="block md:col-span-2">
                <span className="block text-sm font-medium text-gray-700 mb-2">CPF</span>
                <input
                  type="text"
                  value={identityCpf}
                  onChange={(e) => setIdentityCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </label>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mt-4 text-sm text-gray-500">
            Ao continuar, seus dados de visualizacao, IP e dispositivo serao registrados para fins
            de auditoria e evidencias da assinatura.
          </div>

          <div className="flex items-center justify-between gap-3 mt-5">
            <button
              onClick={handleConfirmIdentity}
              disabled={identityLoading || !identityFullName.trim() || !identityEmail.trim()}
              className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-orange-600" />
            <h3 className="font-semibold text-gray-900">Verificacao por OTP</h3>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Para concluir a assinatura, enviaremos um codigo de verificacao para o email cadastrado.
          </p>

          {otpError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-red-700 text-sm">
              {otpError}
            </div>
          )}

          <button
            onClick={handleRequestOtp}
            disabled={otpLoading}
            className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-orange-600" />
            <h3 className="font-semibold text-gray-900">Digite o codigo enviado</h3>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Enviamos um codigo de 6 digitos para{" "}
            <span className="text-gray-700">{emailHint}</span>.
          </p>

          {debugOtpCode && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ambiente local sem SMTP: use o codigo{" "}
              <span className="font-mono font-semibold">{debugOtpCode}</span>.
            </div>
          )}

          {otpError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-red-700 text-sm">
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
              className="w-40 bg-white border border-gray-300 rounded-lg px-4 py-3 text-center text-xl tracking-[0.3em] text-gray-900 font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpCode.length !== 6}
              className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {otpLoading ? "Verificando..." : "Validar codigo"}
            </button>
          </div>

          <button
            onClick={handleRequestOtp}
            disabled={otpLoading}
            className="text-sm text-gray-400 hover:text-orange-600 transition-colors"
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
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">Assinar documento</h3>

          {signError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
              {signError}
            </div>
          )}

          {info.fields.some((field) => field.field_type === "text") && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                missingRequiredTextField
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-100 bg-emerald-50 text-emerald-800"
              }`}
            >
              {missingRequiredTextField
                ? "Preencha os campos obrigatorios destacados diretamente no PDF acima antes de concluir a assinatura."
                : "Os campos de texto deste documento sao preenchidos diretamente no PDF acima."}
            </div>
          )}

          {savedSignature && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-orange-900">
                    Assinatura salva detectada neste navegador
                  </div>
                  <p className="mt-1 text-sm text-orange-800">
                    Use a assinatura do seu perfil como atalho e revise antes de concluir.
                  </p>
                  {savedSignature.updated_at && (
                    <div className="mt-2 text-xs text-orange-700">
                      Atualizada em{" "}
                      {new Date(savedSignature.updated_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applySavedSignature}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
                >
                  Usar assinatura salva
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-lg border border-orange-100 bg-white px-4 py-3 text-sm text-orange-900">
                  <div className="font-medium">
                    {savedSignature.typed_name || info.signatory_name}
                  </div>
                  <div className="mt-1 text-xs text-orange-700">
                    Modo padrao:{" "}
                    {savedSignature.default_mode === "drawn" && savedSignature.signature_image_base64
                      ? "assinatura desenhada"
                      : "assinatura por texto"}
                  </div>
                  {savedSignature.initials && (
                    <div className="mt-1 text-xs text-orange-700">
                      Iniciais salvas: {savedSignature.initials}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-orange-100 bg-white px-4 py-4">
                  {savedSignature.signature_image_base64 ? (
                    <img
                      src={normalizeSignatureImage(savedSignature.signature_image_base64)}
                      alt="Assinatura salva"
                      className="h-20 w-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-20 items-center justify-center text-center text-2xl text-orange-900"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome da assinatura</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSignatureMode("drawn")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                signatureMode === "drawn"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
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
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
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
                <label className="text-sm font-medium text-gray-700">Previa da assinatura</label>
              </div>
              <div className="border border-gray-300 rounded-lg px-6 py-10 bg-white">
                <div
                  className="text-center text-3xl text-gray-900"
                  style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
                >
                  {typedName || "Seu nome aparecera aqui"}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                A assinatura por texto usa o nome informado acima como representacao visual.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="w-full space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span>
                  {info.terms_summary} Isso ocorre nos termos da legislacao aplicavel e da versao{" "}
                  <span className="font-semibold">{info.terms_version}</span> dos{" "}
                  <Link to="/terms" target="_blank" rel="noreferrer" className="text-orange-600 hover:text-orange-700">
                    Termos de Uso
                  </Link>{" "}
                  e da{" "}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className="text-orange-600 hover:text-orange-700">
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
                className="flex items-center gap-2 bg-orange-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5b8,transparent_36%),linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)]">
      <meta name="robots" content="noindex" />

      <div className="border-b border-[#f0dfac] bg-white/88 shadow-sm backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-[#ffd92a] via-[#ffb31b] to-[#090909]" />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <PhSignLogo className="h-12 w-auto" />
          <div className="text-right text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400">
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
    <div className="mt-6 pt-4 border-t border-gray-100">
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          Recusar assinatura
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Tem certeza que deseja recusar? Esta acao nao pode ser desfeita.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da recusa (opcional)"
            rows={2}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
          />
          <div className="flex gap-3">
            <button
              onClick={onRefuse}
              disabled={loading}
              className="bg-red-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Recusando..." : "Confirmar recusa"}
            </button>
            <button
              onClick={() => setShow(false)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
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

