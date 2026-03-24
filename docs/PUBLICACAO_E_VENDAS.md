# Publicacao e Vendas - Checklist

## Objetivo

Checklist pratico para colocar o Uptech Sign em producao e comecar a vender com mais seguranca
operacional e comercial.

## 1. Marca e canais publicos

- definir dominio publico final
- preencher `PUBLIC_APP_NAME`, `LEGAL_ENTITY_NAME`, `SUPPORT_EMAIL`, `SUPPORT_URL`, `PRIVACY_CONTACT_EMAIL` e `DPA_CONTACT_EMAIL`
- revisar paginas `/terms`, `/privacy` e `/dpa`
- validar link de suporte exibido nas paginas publicas

## 2. Infraestrutura

- apontar DNS para o servidor
- configurar proxy reverso com HTTPS
- preencher `.env` de producao
- validar `BASE_URL`, `CORS_ALLOWED_ORIGINS` e `ALLOWED_HOSTS`
- habilitar `TRUST_PROXY_HEADERS=true` somente com proxy confiavel

## 3. Comunicacao

- configurar SMTP real
- validar envio de convite, OTP e documento concluido
- revisar templates de e-mail
- definir remetente institucional definitivo

## 4. Assinatura institucional

- instalar `e-CNPJ A1` definitivo
- validar senha e emissor
- concluir um documento real de teste
- abrir o PDF final no Adobe e no VALIDAR do ITI

## 5. Seguranca e operacao

- manter `DEBUG_EXPOSE_OTP=false`
- definir `SECRET_KEY` forte
- ativar backup diario
- ativar monitoramento operacional
- testar restore periodicamente

## 6. Comercial e juridico

- revisar termos de uso
- revisar politica de privacidade
- revisar `docs/DPA_MODELO.md`
- alinhar contrato comercial com escopo de implantacao, suporte e retencao
- definir SLA e canal de atendimento

## 7. Go-live minimo

Voce esta pronto para vender quando tiver:

- dominio com HTTPS
- SMTP real funcionando
- suporte configurado
- paginas legais revisadas
- backup e monitoramento ativos
- fluxo de assinatura testado ponta a ponta
- certificado institucional validado, se fizer parte da proposta comercial

