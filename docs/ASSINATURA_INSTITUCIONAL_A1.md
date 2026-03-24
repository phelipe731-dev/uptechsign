# Assinatura Institucional A1

O Detter pode selar o PDF final concluido com um certificado institucional ICP-Brasil em arquivo `PFX` ou `P12`.

## O que comprar

- `e-CNPJ A1` do escritorio
- arquivo `PFX/P12` com senha

## Onde colocar

Copie o arquivo para:

- `C:\Users\W11\Desktop\Detter_App\certs\`

Exemplo:

- `C:\Users\W11\Desktop\Detter_App\certs\detter-institucional.pfx`

## Como ativar no Docker

Defina as variaveis de ambiente antes de subir os containers:

```powershell
$env:INSTITUTIONAL_PFX_PATH="detter-institucional.pfx"
$env:INSTITUTIONAL_PFX_PASSWORD="SUA_SENHA_AQUI"
$env:INSTITUTIONAL_SIGNATURE_NAME="Uptech Sign"
docker compose up --build -d
```

## Resultado

Quando o documento for concluido:

- o PDF final sera fechado com o relatorio de assinaturas
- o backend aplicara a assinatura institucional `A1`
- a pagina publica de verificacao mostrara o status da integridade institucional

## Observacao importante

Sem o `PFX/P12`, o fluxo continua funcionando normalmente, mas o PDF final ficara apenas no modo evidencial, sem a selagem institucional ICP-Brasil.
