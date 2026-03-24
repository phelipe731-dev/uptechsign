# Uptech Sign

Plataforma web para geracao, envio, assinatura eletronica e auditoria de documentos, com foco inicial em documentos juridicos e operacionais.

## O que o projeto entrega hoje

- Geracao de documentos a partir de templates DOCX
- Conversao automatica para PDF
- Fluxo de assinatura com link publico, OTP por e-mail e trilha de auditoria
- Campos de assinatura posicionados no PDF
- Relatorio/certificado final com evidencias
- Verificacao publica do documento
- Assinatura institucional A1 opcional no PDF final
- Backup, monitoramento e endurecimento de producao
- Modulo inicial de holerites em massa via CSV + ZIP

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: FastAPI + SQLAlchemy async + Alembic
- Banco: PostgreSQL
- PDF/Docs: LibreOffice, python-docx, PyMuPDF, pyHanko
- Infra: Docker Compose

## Estrutura

- `frontend/`
- `backend/`
- `templates/`
- `storage/`
- `deploy/`
- `docs/`

## Como subir localmente

1. Copie o arquivo `.env.production.example` para `.env` se quiser personalizar as variaveis.
2. Suba os containers:

```powershell
docker compose up --build -d
```

3. Acesse:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Healthcheck backend: [http://localhost:8000/api/health](http://localhost:8000/api/health)

## Login inicial

- E-mail: `admin@detter.adv.br`
- Senha: `Admin123`

## Documentacao util

- Deploy: [docs/DEPLOY_PRODUCAO.md](docs/DEPLOY_PRODUCAO.md)
- Producao segura: [docs/PRODUCAO_SEGURA.md](docs/PRODUCAO_SEGURA.md)
- Backup e restore: [docs/BACKUP_E_RESTORE.md](docs/BACKUP_E_RESTORE.md)
- Monitoramento e alertas: [docs/MONITORAMENTO_E_ALERTAS.md](docs/MONITORAMENTO_E_ALERTAS.md)
- Assinatura institucional A1: [docs/ASSINATURA_INSTITUCIONAL_A1.md](docs/ASSINATURA_INSTITUCIONAL_A1.md)

## Cuidados antes de publicar no GitHub

- Nao versionar `.env`
- Nao versionar certificados em `certs/`
- Nao versionar `storage/`, pois ali ficam documentos, evidencias, segredos em runtime e artefatos operacionais
- Revisar textos juridicos, politica de privacidade e DPA antes de uso comercial

## Status do produto

O projeto ja esta apto para uso em instancia dedicada e ambiente controlado. Para operacao comercial em escala, os proximos blocos mais importantes sao:

- multitenancy / multiempresa
- onboarding comercial
- faturamento / planos
- canais adicionais de envio, como WhatsApp oficial
