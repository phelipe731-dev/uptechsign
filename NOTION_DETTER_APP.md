# 🏢 Detter App — Plataforma de Assinatura Eletrônica

> Substituto do ZapSign para o escritório de advocacia Uptech Sign.
> **Stack:** React + TypeScript + Tailwind | FastAPI + PostgreSQL | Docker Compose

---

# 📊 Visão Geral do Projeto

| Item | Detalhe |
|------|---------|
| **Status** | Em desenvolvimento |
| **Versão** | 1.0-beta |
| **Repositório** | Local (Desktop/Detter_App) |
| **Deploy** | Docker Compose (localhost) |
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000 |
| **Banco de dados** | PostgreSQL 16 |

---

# ✅ Funcionalidades Implementadas

## 🔐 Autenticação & Segurança

- [x] Login com email/senha (JWT)
- [x] Access token + Refresh token (HttpOnly cookie)
- [x] Refresh automático de sessão
- [x] Logout com revogação de token
- [x] Proteção contra brute force (bloqueio após tentativas falhas)
- [x] Rotas protegidas no frontend (ProtectedRoute)
- [x] Sistema de roles: admin / user

## 📊 Dashboard

- [x] 4 cards de status: Finalizados, Em curso, Recusados, Enviados
- [x] Cards clicáveis (filtram documentos por status)
- [x] Lista de documentos recentes (8 itens)
- [x] Fila de pendentes com barra de progresso
- [x] Timeline de atividades recentes (10 itens)
- [x] Auto-refresh a cada 30 segundos

## 📄 Criação de Documentos — Wizard 5 Etapas

- [x] **Etapa 1:** Escolher template DOCX ou upload direto de PDF
- [x] **Etapa 2:** Preencher campos do template (com display_label amigável)
- [x] **Etapa 3:** Adicionar signatários (email, CPF, telefone, papel, ordem)
- [x] **Etapa 4:** Posicionar campos de assinatura/texto no PDF (drag & drop)
- [x] **Etapa 5:** Revisão e envio para assinatura
- [x] Substituição posicional de placeholders no DOCX (labels duplicados tratados)
- [x] Conversão DOCX → PDF via LibreOffice

## 📋 Lista de Documentos

- [x] Tabela com busca por título, ID, nome/email/CPF do signatário
- [x] Filtros: Status, Template, Fonte (template | manual)
- [x] Paginação (15 por página)
- [x] Badges de status coloridos
- [x] Barra de progresso de assinaturas

## 📑 Detalhe do Documento

- [x] Ações: Enviar para assinar, Cancelar, Substituir PDF
- [x] Upload de novo PDF (substitui o anterior, limpa campos)
- [x] Gerenciamento de signatários (CRUD antes do envio)
- [x] Editor de campos de assinatura no PDF
- [x] Signatários read-only após envio (copiar link, reenviar email)
- [x] Download: PDF assinado, Certificado, DOCX original
- [x] Exibição dos dados preenchidos do template
- [x] Link de verificação pública (copiar/abrir)
- [x] Checklist de preparação antes do envio
- [x] Timeline de auditoria com busca e filtros por categoria

## ✍️ Página de Assinatura (Pública — sem login)

- [x] Fluxo multi-step para signatário externo
- [x] **Step 1:** Confirmação de identidade (nome, email, CPF, telefone)
- [x] **Step 2:** Solicitação de OTP por email
- [x] **Step 3:** Verificação do código OTP (6 dígitos)
- [x] **Step 4:** Assinatura (desenhar ou digitar) + campos de texto
- [x] Preview da assinatura (fonte cursiva no modo digitado)
- [x] Opção de usar assinatura salva do perfil
- [x] Validação de campos obrigatórios
- [x] Opção de recusar com motivo
- [x] Telas de confirmação (sucesso / recusa)

## 🔍 Verificação Pública

- [x] Página `/verify/{code}` acessível sem login
- [x] Exibe status do documento e código de verificação
- [x] Hashes SHA-256 dos arquivos para integridade
- [x] Download do PDF assinado e certificado
- [x] Evidências completas por signatário (nome, email, CPF mascarado, IP, dispositivo, timestamps)

## 📜 Certificado PDF

- [x] Layout estilo "Relatório de Assinaturas" (inspirado no ZapSign)
- [x] Barra superior com branding "Uptech Sign"
- [x] Cards individuais por signatário com badge de status
- [x] Imagem da assinatura + pontos de autenticação
- [x] Hash do documento + data/hora de cada ação

## 📝 Templates DOCX

- [x] Upload de DOCX com auto-detecção de campos `[PLACEHOLDER]`
- [x] Edição de nome, descrição e mapeamento de campos
- [x] FieldMapper: reordenar, editar chave, toggle obrigatório
- [x] Substituição de arquivo DOCX com re-detecção automática
- [x] Soft-delete (desativar sem excluir)
- [x] Campo `label` (texto exato no DOCX) + `display_label` (nome amigável)

## ⚙️ Configurações

- [x] Perfil de assinatura pessoal (desenhar ou digitar, nome + iniciais)
- [x] Configuração SMTP (admin): host, porta, usuário, senha, remetente
- [x] Botão de teste de conexão SMTP
- [x] Alteração de senha

## 📧 Sistema de Emails

- [x] Convite de assinatura com link único
- [x] Envio de código OTP
- [x] Notificação de conclusão do documento
- [x] Notificação de recusa
- [x] Lembrete automático (background task a cada hora, >24h sem ação)

## 🔒 Segurança Jurídica

- [x] OTP por email (hash, cooldown 60s, expiração, limite de tentativas)
- [x] Confirmação de identidade multi-fator
- [x] Ordem de assinatura sequencial ou paralela
- [x] Registro completo: IP, user-agent, timestamps por etapa
- [x] Audit log detalhado (AuditLog + SignatureEvent)
- [x] Suporte a certificado digital A1 institucional (PAdES-B-B, opcional)
- [x] QR Code de verificação no certificado

## 🎨 Interface & Layout

- [x] Tema claro (light) estilo ZapSign
- [x] Sidebar branca com logo "DD" azul
- [x] Cor primária: blue-600
- [x] Badges coloridos por status (verde, amarelo, vermelho, azul, cinza)
- [x] Cards brancos com bordas sutis em fundo gray-50
- [x] Responsivo (Tailwind CSS)

## 🐳 Infraestrutura

- [x] Docker Compose: PostgreSQL + Backend + Frontend (Nginx)
- [x] Volumes persistentes (banco, storage, templates)
- [x] Healthcheck no PostgreSQL
- [x] Migrations com Alembic
- [x] Seed.py com upsert de templates pré-configurados

---

# 🔲 Funcionalidades Pendentes / Melhorias Futuras

## 🔴 Prioridade Alta

- [ ] **Deploy em produção** — Configurar servidor (VPS/cloud), domínio, HTTPS (Let's Encrypt), variáveis de ambiente seguras
- [ ] **Envio de emails real** — Validar SMTP em produção com domínio próprio (ex: noreply@detteradvocacia.com.br)
- [ ] **Testes end-to-end** — Testar fluxo completo: criar documento → enviar → assinar → certificado → verificar
- [ ] **Backup automático do banco** — Cron job para dump do PostgreSQL diário
- [ ] **Notificações em tempo real** — WebSocket ou polling para atualizar status sem refresh manual
- [ ] **Expiração de documentos** — Background task para marcar documentos expirados automaticamente
- [ ] **Gestão de usuários (Admin)** — CRUD completo de usuários do escritório (criar, editar, desativar, reset de senha)

## 🟡 Prioridade Média

- [ ] **Assinatura em lote** — Selecionar múltiplos documentos e enviar para assinatura de uma vez
- [ ] **Modelos de signatários** — Salvar grupos de signatários frequentes (ex: "Casal + 2 Testemunhas")
- [ ] **Duplicar documento** — Criar novo documento a partir de um existente (copiar campos e signatários)
- [ ] **Busca avançada / filtros por data** — Filtrar documentos por período (criação, envio, conclusão)
- [ ] **Relatórios e exportação** — Exportar lista de documentos em CSV/Excel com filtros
- [ ] **Tema escuro (toggle)** — Opção de alternar entre tema claro e escuro
- [ ] **Idioma / i18n** — Suporte a múltiplos idiomas (atualmente só português)
- [ ] **Logs de acesso do sistema** — Painel admin com log de logins, ações críticas, erros
- [ ] **Rate limiting na API** — Proteção contra abuso nas rotas públicas (sign, verify, OTP)
- [ ] **Validação de CPF real** — Verificar dígitos verificadores do CPF (não apenas formato)
- [ ] **Preview do PDF no wizard** — Mostrar preview do PDF gerado antes de enviar para assinatura

## 🟢 Prioridade Baixa / Nice-to-have

- [ ] **App mobile (PWA)** — Transformar frontend em Progressive Web App para acesso mobile
- [ ] **Integração com WhatsApp** — Enviar link de assinatura via WhatsApp (API Business)
- [ ] **Assinatura por SMS OTP** — Alternativa ao email para envio do código OTP
- [ ] **Webhook / API pública** — Notificar sistemas externos quando documento for assinado
- [ ] **Pasta/Organização de documentos** — Agrupar documentos por pastas, clientes ou casos
- [ ] **Comentários internos** — Notas internas no documento (visíveis só para a equipe)
- [ ] **Histórico de versões** — Versionamento de templates e documentos
- [ ] **Assinatura com certificado digital pessoal (e-CPF)** — Integração com certificados A3/cloud ICP-Brasil
- [ ] **Dashboard de métricas** — Gráficos: documentos por mês, tempo médio de assinatura, taxa de recusa
- [ ] **Lixeira com recuperação** — Documentos cancelados/excluídos vão para lixeira antes de exclusão permanente
- [ ] **Marca d'água no PDF** — Adicionar "RASCUNHO" ou "CÓPIA" em PDFs não finalizados
- [ ] **Auditoria exportável** — Download do audit trail completo em PDF para processos judiciais
- [ ] **Custom branding** — Personalizar logo, cores e nome da empresa na página de assinatura pública
- [ ] **2FA para login (TOTP)** — Autenticação em dois fatores para usuários do escritório
- [ ] **Integração com Google Drive / OneDrive** — Salvar documentos finalizados automaticamente na nuvem
- [ ] **Assinatura presencial (tablet)** — Modo quiosque para assinatura em tablet no escritório

---

# 🗂️ Arquitetura Técnica

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | FastAPI (Python), async/await |
| Banco | PostgreSQL 16 (SQLAlchemy + Alembic) |
| PDF | PyMuPDF (fitz), python-docx, LibreOffice |
| Auth | JWT (access + refresh), bcrypt |
| Email | SMTP (aiosmtplib) |
| Deploy | Docker Compose (Nginx + Uvicorn + PostgreSQL) |

## Estrutura de Pastas

```
Detter_App/
├── backend/
│   ├── app/
│   │   ├── api/           # Endpoints da API
│   │   │   ├── auth.py
│   │   │   ├── documents.py
│   │   │   ├── signatures.py
│   │   │   ├── signatories.py
│   │   │   ├── signature_fields.py
│   │   │   ├── templates.py
│   │   │   ├── verification.py
│   │   │   ├── settings.py
│   │   │   ├── dashboard.py
│   │   │   └── deps.py
│   │   ├── models/        # Modelos do banco
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── signatory.py
│   │   │   ├── signature_field.py
│   │   │   ├── template.py
│   │   │   ├── document_file.py
│   │   │   ├── audit_log.py
│   │   │   ├── signature_event.py
│   │   │   └── refresh_token.py
│   │   ├── schemas/       # Validação de dados
│   │   ├── services/      # Lógica de negócio
│   │   │   ├── auth_service.py
│   │   │   ├── document_generator.py
│   │   │   ├── email_service.py
│   │   │   ├── otp_service.py
│   │   │   ├── pdf_service.py
│   │   │   ├── signature_service.py
│   │   │   └── institutional_signature_service.py
│   │   ├── main.py
│   │   ├── config.py
│   │   └── database.py
│   ├── alembic/           # Migrations
│   ├── seed.py            # Dados iniciais
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/         # Páginas
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentNew.tsx
│   │   │   ├── DocumentDetail.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Templates.tsx
│   │   │   ├── SignPage.tsx
│   │   │   └── VerifyDocument.tsx
│   │   ├── components/    # Componentes reutilizáveis
│   │   │   ├── documents/
│   │   │   │   ├── DocumentWizard.tsx
│   │   │   │   ├── DocumentUploadStep.tsx
│   │   │   │   ├── SignatoriesStep.tsx
│   │   │   │   ├── SignaturePositionStep.tsx
│   │   │   │   ├── SignatoryManager.tsx
│   │   │   │   ├── SignatureFieldEditor.tsx
│   │   │   │   ├── SendDocumentStep.tsx
│   │   │   │   └── AuthenticationOptions.tsx
│   │   │   ├── signatures/
│   │   │   │   ├── SignaturePad.tsx
│   │   │   │   └── PublicSigningPdfViewer.tsx
│   │   │   ├── templates/
│   │   │   │   └── FieldMapper.tsx
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   └── layout/
│   │   │       └── Layout.tsx
│   │   ├── services/      # Chamadas à API
│   │   ├── hooks/         # Hooks customizados
│   │   └── types/         # Tipos TypeScript
│   ├── Dockerfile
│   └── nginx.conf
├── storage/               # Arquivos gerados (PDFs, DOCX)
├── templates/             # Templates DOCX
└── docker-compose.yml
```

## Modelos do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| **users** | Usuários do sistema (admin/user), senha hash, assinatura salva |
| **documents** | Documentos criados, status, dados dos campos, vencimento |
| **signatories** | Signatários por documento, status individual, dados de autenticação |
| **signature_fields** | Campos posicionados no PDF (assinatura, iniciais, texto) |
| **document_files** | Referências a arquivos (DOCX original, PDF gerado, PDF assinado, certificado) |
| **templates** | Templates DOCX com campos configuráveis |
| **audit_logs** | Log completo de todas as ações |
| **signature_events** | Eventos detalhados do processo de assinatura |
| **refresh_tokens** | Tokens de refresh com expiração e rotação |

## Fluxo de Status do Documento

```
generated → sent → in_signing → completed
                              → refused
                              → expired
              → cancelled
```

## Fluxo de Status do Signatário

```
pending → sent → viewed → identity_confirmed → otp_verified → signed
                                                             → refused
```

---

# 🚀 Como Rodar

```bash
# Subir todos os serviços
docker compose up -d --build

# Rodar seed (popular templates)
docker compose exec backend python seed.py

# Acessar
# Frontend: http://localhost:3000
# API: http://localhost:8000/docs
```

---

# 📝 Notas de Desenvolvimento

- O tema visual foi copiado do ZapSign (light, blue-600, cards brancos)
- Templates DOCX usam `[PLACEHOLDER]` para campos substituíveis
- O campo `label` no template deve ser EXATAMENTE igual ao texto entre colchetes no DOCX
- Placeholders duplicados (ex: `[nº do RG]` aparecendo 2x) são tratados por ordem posicional
- O certificado PDF é gerado com PyMuPDF (fitz) usando desenho programático
- Certificado institucional A1 (PAdES-B-B) é opcional, configurável via variáveis de ambiente
