# Deploy de Producao - Uptech Sign

## 1. Preparar variaveis

1. Copie `.env.production.example` para `.env`
2. Ajuste:
   - `BASE_URL`
   - `SECRET_KEY`
   - `CORS_ALLOWED_ORIGINS`
   - `ALLOWED_HOSTS`
   - `SMTP_*`
   - `INSTITUTIONAL_PFX_*`

## 2. Subir a stack

Na raiz do projeto:

```powershell
docker compose up --build -d
```

## 3. Validar saude

Backend:

```powershell
curl.exe http://localhost:8000/api/health
```

Frontend:

```powershell
curl.exe -I http://localhost:3000/
```

## 4. Colocar HTTPS na frente

Use um proxy reverso externo apontando para `http://127.0.0.1:3000`.

Arquivos de exemplo:

- `deploy/nginx/uptech-sign.conf.example`
- `deploy/caddy/Caddyfile.example`

## 5. Regras importantes

- `TRUST_PROXY_HEADERS=true` somente quando houver proxy reverso confiavel na frente
- `DEBUG_EXPOSE_OTP=false` em producao
- `SECRET_KEY` precisa ser trocada
- `BASE_URL` deve ser o dominio https publico final

## 6. Fluxo recomendado

1. Configurar o dominio
2. Configurar HTTPS
3. Ajustar `.env`
4. Subir `docker compose`
5. Entrar em `Configuracoes` e validar:
   - SMTP
   - certificado institucional
6. Gerar um documento de teste
7. Validar o PDF final no Adobe e no VALIDAR

## 7. Observacao sobre IP real

Para o sistema registrar o IP publico correto do signatario no relatorio:

- o acesso deve acontecer pelo dominio publico
- o proxy reverso deve encaminhar:
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
  - `X-Forwarded-Host`

Em `localhost`, o normal e aparecer IP interno.
