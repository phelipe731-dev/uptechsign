# Producao Segura - Uptech Sign

## O que este bloco ja entrega no codigo

- `rate limit` nos endpoints publicos de assinatura e verificacao
- `security headers` no backend e no Nginx
- `healthcheck` mais completo em `/api/health`
- `CORS`, `allowed hosts` e confianca em proxy configuraveis por ambiente
- `docker-compose` com `restart`, `healthcheck` e variaveis de ambiente preparadas para producao

## Variaveis recomendadas

Crie um arquivo `.env` na raiz com algo proximo de:

```env
APP_ENV=production
BASE_URL=https://assinar.seudominio.com.br
SECRET_KEY=gere-um-token-longo-e-aleatorio
CORS_ALLOWED_ORIGINS=https://assinar.seudominio.com.br
ALLOWED_HOSTS=assinar.seudominio.com.br,localhost,127.0.0.1
TRUST_PROXY_HEADERS=true
DEBUG_EXPOSE_OTP=false
INSTITUTIONAL_PFX_PATH=certificado-a1.pfx
INSTITUTIONAL_PFX_PASSWORD=sua-senha
INSTITUTIONAL_SIGNATURE_NAME=Uptech Sign
INSTITUTIONAL_SIGNATURE_PROFILE=PAdES-B-B
```

## Checklist de producao

1. Colocar o sistema atras de HTTPS real.
2. Configurar `BASE_URL` com o dominio publico final.
3. Ativar `TRUST_PROXY_HEADERS=true` somente quando houver proxy reverso confiavel.
4. Manter `DEBUG_EXPOSE_OTP=false`.
5. Trocar `SECRET_KEY` por um valor longo e aleatorio.
6. Configurar SMTP real.
7. Usar o `e-CNPJ A1` definitivo no lugar do certificado temporario.
8. Validar um PDF final no Adobe e no VALIDAR.
9. Fazer rotina de backup de `storage/` e do banco PostgreSQL.
10. Restringir acesso ao servidor e ao volume `certs/`.

## Rate limits atuais

Janela padrao: `600s`

- consulta do link publico: `60`
- visualizacao do PDF publico: `60`
- confirmacao de identidade: `20`
- pedido de OTP: `6`
- validacao de OTP: `12`
- envio da assinatura: `8`
- recusa: `6`
- verificacao publica: `60`

Se necessario, esses limites podem ser ajustados no `backend/app/config.py`.

## O que ainda depende de infraestrutura externa

- HTTPS com certificado do dominio
- SMTP de producao
- backup automatizado do servidor
- monitoramento externo e alertas
- e-CNPJ A1 definitivo
