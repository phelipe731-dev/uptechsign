import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, FileBadge, KeyRound, Mail, Save, Send, Server, Signature, Type, Upload, UserCircle2, XCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { changeMyPassword, updateMe, updateMySignature } from "../services/auth";
import {
  getEmailTemplates,
  getInstitutionSettings,
  getSmtpSettings,
  testSmtp,
  updateEmailTemplates,
  updateInstitutionSettings,
  updateSmtpSettings,
  uploadInstitutionCertificate,
  type EmailTemplateEntry,
  type InstitutionSettings,
  type SmtpSettings,
} from "../services/settings";
import SignaturePad from "../components/signatures/SignaturePad";

type SignatureMode = "drawn" | "typed";
type Flash = { ok: boolean; message: string } | null;
const input = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export default function Settings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [profile, setProfile] = useState({ full_name: "", email: "" });
  const [password, setPassword] = useState({ current_password: "", new_password: "" });
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("drawn");
  const [typedName, setTypedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [initials, setInitials] = useState("");
  const [profileFlash, setProfileFlash] = useState<Flash>(null);
  const [passwordFlash, setPasswordFlash] = useState<Flash>(null);
  const [signatureFlash, setSignatureFlash] = useState<Flash>(null);

  const [smtp, setSmtp] = useState<SmtpSettings>({ smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "", smtp_from: "", smtp_from_name: "" });
  const [smtpFlash, setSmtpFlash] = useState<Flash>(null);
  const [testTo, setTestTo] = useState("");
  const [testFlash, setTestFlash] = useState<Flash>(null);

  const [institution, setInstitution] = useState<InstitutionSettings>({
    signature_name: "Uptech Sign",
    signature_profile: "PAdES-B-B",
    certificate_password: "",
    legal_entity_name: "Uptech Sign",
    legal_address: "",
    support_email: "",
    support_whatsapp: "",
    support_url: "",
    privacy_contact_email: "",
    dpa_contact_email: "",
  });
  const [institutionFlash, setInstitutionFlash] = useState<Flash>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const certificateInputRef = useRef<HTMLInputElement | null>(null);

  const [templates, setTemplates] = useState<EmailTemplateEntry[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [templatesFlash, setTemplatesFlash] = useState<Flash>(null);

  const { data: smtpData, isLoading: smtpLoading } = useQuery({ queryKey: ["smtp-settings"], queryFn: getSmtpSettings, enabled: isAdmin });
  const { data: institutionData, isLoading: institutionLoading } = useQuery({ queryKey: ["institution-settings"], queryFn: getInstitutionSettings, enabled: isAdmin });
  const { data: templatesData, isLoading: templatesLoading } = useQuery({ queryKey: ["email-templates"], queryFn: getEmailTemplates, enabled: isAdmin });

  useEffect(() => {
    if (!user) return;
    setProfile({ full_name: user.full_name || "", email: user.email || "" });
    setTypedName(user.signature_data?.typed_name || user.full_name || "");
    setInitials(user.signature_data?.initials || buildInitials(user.full_name || ""));
    setSignatureMode(user.signature_data?.default_mode || "drawn");
    setSignatureImage(normalizeSignatureImage(user.signature_data?.signature_image_base64 || ""));
  }, [user]);

  useEffect(() => {
    if (!smtpData) return;
    setSmtp({ smtp_host: smtpData.smtp_host, smtp_port: smtpData.smtp_port, smtp_user: smtpData.smtp_user, smtp_password: "", smtp_from: smtpData.smtp_from, smtp_from_name: smtpData.smtp_from_name });
  }, [smtpData]);

  useEffect(() => {
    if (!institutionData) return;
    setInstitution({
      signature_name: institutionData.signature_name,
      signature_profile: institutionData.signature_profile,
      certificate_password: "",
      legal_entity_name: institutionData.legal_entity_name,
      legal_address: institutionData.legal_address,
      support_email: institutionData.support_email,
      support_whatsapp: institutionData.support_whatsapp,
      support_url: institutionData.support_url,
      privacy_contact_email: institutionData.privacy_contact_email,
      dpa_contact_email: institutionData.dpa_contact_email,
    });
  }, [institutionData]);

  useEffect(() => {
    if (!templatesData) return;
    setTemplates(templatesData.templates);
    if (!templateKey && templatesData.templates[0]) setTemplateKey(templatesData.templates[0].key);
  }, [templatesData, templateKey]);

  const selectedTemplate = useMemo(() => templates.find((item) => item.key === templateKey) ?? null, [templates, templateKey]);

  const profileMutation = useMutation({ mutationFn: updateMe, onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setProfileFlash({ ok: true, message: "Perfil atualizado com sucesso." }); }, onError: (err) => setProfileFlash({ ok: false, message: extractError(err) }) });
  const passwordMutation = useMutation({ mutationFn: changeMyPassword, onSuccess: () => { setPassword({ current_password: "", new_password: "" }); setPasswordFlash({ ok: true, message: "Senha atualizada com sucesso." }); }, onError: (err) => setPasswordFlash({ ok: false, message: extractError(err) }) });
  const signatureMutation = useMutation({ mutationFn: updateMySignature, onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setSignatureFlash({ ok: true, message: "Assinatura salva com sucesso." }); }, onError: (err) => setSignatureFlash({ ok: false, message: extractError(err) }) });
  const smtpMutation = useMutation({ mutationFn: updateSmtpSettings, onSuccess: () => { qc.invalidateQueries({ queryKey: ["smtp-settings"] }); setSmtpFlash({ ok: true, message: "SMTP salvo com sucesso." }); }, onError: (err) => setSmtpFlash({ ok: false, message: extractError(err) }) });
  const institutionMutation = useMutation({ mutationFn: updateInstitutionSettings, onSuccess: () => { qc.invalidateQueries({ queryKey: ["institution-settings"] }); setInstitutionFlash({ ok: true, message: "Configuracoes institucionais salvas." }); }, onError: (err) => setInstitutionFlash({ ok: false, message: extractError(err) }) });
  const uploadMutation = useMutation({ mutationFn: uploadInstitutionCertificate, onSuccess: () => { qc.invalidateQueries({ queryKey: ["institution-settings"] }); setCertificateFile(null); setInstitutionFlash({ ok: true, message: "Certificado enviado com sucesso." }); }, onError: (err) => setInstitutionFlash({ ok: false, message: extractError(err) }) });
  const templatesMutation = useMutation({ mutationFn: updateEmailTemplates, onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-templates"] }); setTemplatesFlash({ ok: true, message: "Templates salvos com sucesso." }); }, onError: (err) => setTemplatesFlash({ ok: false, message: extractError(err) }) });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuracoes</h1>
        <p className="mt-1 text-sm text-gray-400">Perfil pessoal, assinatura salva e administracao institucional.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-8">
          <Card title="Perfil" icon={<UserCircle2 size={18} className="text-orange-600" />}>
            <Grid2>
              <Field label="Nome completo"><input className={input} value={profile.full_name} onChange={(e) => setProfile((v) => ({ ...v, full_name: e.target.value }))} /></Field>
              <Field label="E-mail"><input className={input} type="email" value={profile.email} onChange={(e) => setProfile((v) => ({ ...v, email: e.target.value }))} /></Field>
            </Grid2>
            <FlashView flash={profileFlash} />
            <Button onClick={() => void profileMutation.mutateAsync({ full_name: profile.full_name.trim(), email: profile.email.trim() })} disabled={profileMutation.isPending || !profile.full_name.trim() || !profile.email.trim()}><Save size={15} />{profileMutation.isPending ? "Salvando..." : "Salvar perfil"}</Button>
          </Card>

          <Card title="Alterar senha" icon={<KeyRound size={18} className="text-orange-600" />}>
            <Grid2>
              <Field label="Senha atual"><input className={input} type="password" value={password.current_password} onChange={(e) => setPassword((v) => ({ ...v, current_password: e.target.value }))} /></Field>
              <Field label="Nova senha"><input className={input} type="password" value={password.new_password} onChange={(e) => setPassword((v) => ({ ...v, new_password: e.target.value }))} /></Field>
            </Grid2>
            <FlashView flash={passwordFlash} />
            <Button onClick={() => void passwordMutation.mutateAsync(password)} disabled={passwordMutation.isPending || !password.current_password.trim() || !password.new_password.trim()}><Save size={15} />{passwordMutation.isPending ? "Atualizando..." : "Atualizar senha"}</Button>
          </Card>

          <Card title="Assinatura salva no perfil" icon={<Signature size={18} className="text-orange-600" />}>
            <Grid2>
              <Field label="Nome da assinatura"><input className={input} value={typedName} onChange={(e) => setTypedName(e.target.value)} /></Field>
              <Field label="Iniciais"><input className={input} value={initials} onChange={(e) => setInitials(e.target.value.slice(0, 4).toUpperCase())} /></Field>
            </Grid2>
            <div className="flex flex-wrap gap-2">
              <Mode active={signatureMode === "drawn"} onClick={() => setSignatureMode("drawn")}><Signature size={16} />Assinatura desenhada</Mode>
              <Mode active={signatureMode === "typed"} onClick={() => setSignatureMode("typed")}><Type size={16} />Assinatura por texto</Mode>
            </div>
            {signatureMode === "drawn" ? (
              <SignaturePad onSignature={setSignatureImage} initialValue={signatureImage} />
            ) : (
              <div className="rounded-lg border border-gray-300 bg-white px-6 py-10 text-center text-3xl text-gray-900" style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}>{typedName || "Sua assinatura em texto aparecera aqui"}</div>
            )}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">Essa assinatura pode ser reutilizada como atalho no fluxo de assinatura no mesmo navegador.</div>
            <FlashView flash={signatureFlash} />
            <Button onClick={() => void signatureMutation.mutateAsync({ default_mode: signatureMode, typed_name: typedName.trim(), signature_image_base64: signatureImageToBase64(signatureImage), initials: initials.trim().toUpperCase() })} disabled={signatureMutation.isPending || !typedName.trim()}><Save size={15} />{signatureMutation.isPending ? "Salvando..." : "Salvar assinatura"}</Button>
          </Card>
        </div>

        {isAdmin && (
          <div className="space-y-8">
            <Card title="Instituicao e certificado" icon={<FileBadge size={18} className="text-orange-600" />}>
              {institutionLoading ? <Muted>Carregando configuracoes institucionais...</Muted> : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Pill ok={!!institutionData?.certificate_configured} text={institutionData?.certificate_configured ? "ICP institucional ativo" : institutionData?.certificate_uploaded ? "Certificado enviado, revisar senha" : "Certificado nao enviado"} />
                    {institutionData?.certificate_filename && <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">{institutionData.certificate_filename}</span>}
                  </div>
                  <Grid2>
                    <Field label="Nome institucional"><input className={input} value={institution.signature_name} onChange={(e) => setInstitution((v) => ({ ...v, signature_name: e.target.value }))} /></Field>
                    <Field label="Perfil de assinatura"><input className={input} value={institution.signature_profile} onChange={(e) => setInstitution((v) => ({ ...v, signature_profile: e.target.value }))} /></Field>
                  </Grid2>
                  <Grid2>
                    <Field label="Razao social / nome juridico"><input className={input} value={institution.legal_entity_name} onChange={(e) => setInstitution((v) => ({ ...v, legal_entity_name: e.target.value }))} /></Field>
                    <Field label="E-mail de suporte"><input className={input} type="email" value={institution.support_email} onChange={(e) => setInstitution((v) => ({ ...v, support_email: e.target.value }))} /></Field>
                    <Field label="WhatsApp / telefone de suporte"><input className={input} value={institution.support_whatsapp} onChange={(e) => setInstitution((v) => ({ ...v, support_whatsapp: e.target.value }))} /></Field>
                    <Field label="URL do suporte / central de ajuda"><input className={input} value={institution.support_url} onChange={(e) => setInstitution((v) => ({ ...v, support_url: e.target.value }))} /></Field>
                    <Field label="E-mail de privacidade"><input className={input} type="email" value={institution.privacy_contact_email} onChange={(e) => setInstitution((v) => ({ ...v, privacy_contact_email: e.target.value }))} /></Field>
                    <Field label="E-mail para DPA / due diligence"><input className={input} type="email" value={institution.dpa_contact_email} onChange={(e) => setInstitution((v) => ({ ...v, dpa_contact_email: e.target.value }))} /></Field>
                  </Grid2>
                  <Field label="Endereco juridico">
                    <textarea
                      className={`${input} min-h-[92px]`}
                      rows={3}
                      value={institution.legal_address}
                      onChange={(e) => setInstitution((v) => ({ ...v, legal_address: e.target.value }))}
                    />
                  </Field>
                  <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                    Esses dados alimentam as paginas publicas de termos, privacidade, DPA e os
                    canais de suporte exibidos no login, assinatura e verificacao publica.
                  </div>
                  <Field label={institutionData?.certificate_password_set ? "Senha do certificado (ja configurada)" : "Senha do certificado"}>
                    <input className={input} type="password" value={institution.certificate_password} onChange={(e) => setInstitution((v) => ({ ...v, certificate_password: e.target.value }))} placeholder={institutionData?.certificate_password_set ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : ""} />
                  </Field>
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4">
                    <div className="text-sm font-medium text-gray-700">Upload do certificado A1 (.pfx/.p12)</div>
                    <input
                      ref={certificateInputRef}
                      type="file"
                      accept=".pfx,.p12"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-700">
                          {certificateFile ? "Certificado selecionado" : "Nenhum certificado selecionado"}
                        </div>
                        <div className="mt-1 truncate text-sm text-gray-500">
                          {certificateFile
                            ? certificateFile.name
                            : "Selecione um arquivo .pfx ou .p12 para habilitar o envio."}
                        </div>
                      </div>
                      <AltButton onClick={() => certificateInputRef.current?.click()} disabled={uploadMutation.isPending}>
                        <Upload size={15} />
                        {certificateFile ? "Trocar arquivo" : "Selecionar arquivo"}
                      </AltButton>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <AltButton onClick={() => void uploadMutation.mutateAsync(certificateFile!)} disabled={!certificateFile || uploadMutation.isPending}><Upload size={15} />{uploadMutation.isPending ? "Enviando..." : "Enviar certificado"}</AltButton>
                      <Button onClick={() => void institutionMutation.mutateAsync(institution)} disabled={institutionMutation.isPending}><Save size={15} />{institutionMutation.isPending ? "Salvando..." : "Salvar configuracoes"}</Button>
                    </div>
                    {!certificateFile && (
                      <div className="mt-3 text-sm text-amber-700">
                        O envio do certificado fica disponivel assim que voce selecionar o arquivo.
                      </div>
                    )}
                  </div>
                  <Grid2>
                    <Info label="Titular detectado" value={institutionData?.signer_name || "-"} />
                    <Info label="Emissor" value={institutionData?.issuer_name || "-"} />
                    <Info label="Validade" value={formatDateTime(institutionData?.valid_until ?? null)} />
                    <Info label="Serial" value={institutionData?.certificate_serial || "-"} />
                  </Grid2>
                  {institutionData?.certificate_error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{institutionData.certificate_error}</div>}
                  <FlashView flash={institutionFlash} />
                </>
              )}
            </Card>

            <Card title="Configuracao de e-mail (SMTP)" icon={<Server size={18} className="text-orange-600" />}>
              {smtpLoading ? <Muted>Carregando configuracoes SMTP...</Muted> : (
                <>
                  <Grid2>
                    <Field label="Servidor SMTP"><input className={input} value={smtp.smtp_host} onChange={(e) => setSmtp((v) => ({ ...v, smtp_host: e.target.value }))} /></Field>
                    <Field label="Porta"><input className={input} type="number" value={smtp.smtp_port} onChange={(e) => setSmtp((v) => ({ ...v, smtp_port: parseInt(e.target.value, 10) || 587 }))} /></Field>
                    <Field label="Usuario"><input className={input} value={smtp.smtp_user} onChange={(e) => setSmtp((v) => ({ ...v, smtp_user: e.target.value }))} /></Field>
                    <Field label={smtpData?.smtp_password_set ? "Senha (ja configurada)" : "Senha"}><input className={input} type="password" value={smtp.smtp_password} onChange={(e) => setSmtp((v) => ({ ...v, smtp_password: e.target.value }))} placeholder={smtpData?.smtp_password_set ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : ""} /></Field>
                    <Field label="E-mail remetente"><input className={input} type="email" value={smtp.smtp_from} onChange={(e) => setSmtp((v) => ({ ...v, smtp_from: e.target.value }))} /></Field>
                    <Field label="Nome remetente"><input className={input} value={smtp.smtp_from_name} onChange={(e) => setSmtp((v) => ({ ...v, smtp_from_name: e.target.value }))} /></Field>
                  </Grid2>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void smtpMutation.mutateAsync(smtp)} disabled={smtpMutation.isPending}><Save size={15} />{smtpMutation.isPending ? "Salvando..." : "Salvar SMTP"}</Button>
                    {smtpData?.configured && <Pill ok text="SMTP configurado" />}
                  </div>
                  <FlashView flash={smtpFlash} />
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <div className="mb-3 text-sm font-medium text-gray-700">Testar envio de e-mail</div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input className={`${input} flex-1`} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="destinatario@email.com" />
                      <AltButton onClick={() => void (async () => { try { const res = await testSmtp(testTo.trim()); setTestFlash({ ok: true, message: res.message }); } catch (err) { setTestFlash({ ok: false, message: extractError(err) }); } })()} disabled={!testTo.trim()}><Send size={15} />Enviar teste</AltButton>
                    </div>
                    <div className="mt-3"><FlashView flash={testFlash} compact /></div>
                  </div>
                </>
              )}
            </Card>

            <Card title="Templates de e-mail" icon={<Mail size={18} className="text-orange-600" />}>
              {templatesLoading ? <Muted>Carregando templates...</Muted> : (
                <>
                  <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {templates.map((template) => (
                        <button key={template.key} type="button" onClick={() => setTemplateKey(template.key)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${templateKey === template.key ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}>
                          <div className="font-medium">{template.label}</div>
                          <div className="mt-1 text-xs text-gray-500">{template.description}</div>
                        </button>
                      ))}
                    </div>
                    {selectedTemplate ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">Variaveis disponiveis: {selectedTemplate.placeholders.map((item) => `{{${item}}}`).join(", ")}</div>
                        <Field label="Assunto"><input className={input} value={selectedTemplate.subject} onChange={(e) => setTemplates((current) => current.map((item) => item.key === selectedTemplate.key ? { ...item, subject: e.target.value } : item))} /></Field>
                        <Field label="HTML do corpo"><textarea className={`${input} min-h-[280px]`} rows={14} value={selectedTemplate.body_html} onChange={(e) => setTemplates((current) => current.map((item) => item.key === selectedTemplate.key ? { ...item, body_html: e.target.value } : item))} /></Field>
                      </div>
                    ) : (
                      <Muted>Selecione um template para editar.</Muted>
                    )}
                  </div>
                  <FlashView flash={templatesFlash} />
                  <Button onClick={() => templatesMutation.mutate(templates)} disabled={templatesMutation.isPending || templates.length === 0}><Save size={15} />{templatesMutation.isPending ? "Salvando..." : "Salvar templates"}</Button>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">{icon}<h2 className="font-semibold text-gray-900">{title}</h2></div><div className="space-y-5 p-6">{children}</div></div>;
}
function Grid2({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 md:grid-cols-2">{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>{children}</label>; }
function Pill({ ok, text }: { ok: boolean; text: string }) { return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{text}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-400">{label}</div><div className="mt-1 break-all text-sm text-gray-700">{value}</div></div>; }
function FlashView({ flash, compact = false }: { flash: Flash; compact?: boolean }) { if (!flash) return null; return <div className={`flex items-center gap-2 rounded-lg border px-4 ${compact ? "py-2" : "py-3"} text-sm ${flash.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{flash.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}{flash.message}</div>; }
function Button({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) { return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50">{children}</button>; }
function AltButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) { return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50">{children}</button>; }
function Mode({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${active ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-300 text-gray-600 hover:border-gray-400"}`}>{children}</button>; }
function Muted({ children }: { children: React.ReactNode }) { return <div className="text-sm text-gray-400">{children}</div>; }

function normalizeSignatureImage(value: string) { if (!value) return ""; if (value.startsWith("data:image")) return value; return `data:image/png;base64,${value}`; }
function signatureImageToBase64(value: string) { if (!value) return null; return value.includes(",") ? value.split(",")[1] : value; }
function buildInitials(name: string) { const parts = name.split(/\s+/).map((part) => part.trim()).filter(Boolean); if (parts.length === 0) return ""; if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase(); }
function formatDateTime(value: string | null) { if (!value) return "-"; return new Date(value).toLocaleString("pt-BR"); }
function extractError(err: unknown) { if (err && typeof err === "object" && "response" in err) { const resp = (err as { response?: { data?: { detail?: string } } }).response; return resp?.data?.detail ?? "Erro inesperado."; } return "Erro de conexao."; }

