# Monitoramento e Alertas - Uptech Sign

## Scripts disponiveis

- `scripts/check-uptech-health.ps1`
- `scripts/send-ops-alert.py`
- `scripts/register-healthcheck-task.ps1`
- `scripts/unregister-healthcheck-task.ps1`

## O que o monitor verifica

O script principal faz, por padrao:

- healthcheck do backend em `/api/health`
- disponibilidade basica do frontend
- idade do ultimo backup `.zip` em `backups/`

Ele grava logs em `ops/logs/` e guarda estado em `ops/state/` para evitar alertas repetidos demais.

## Rodar manualmente

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1
```

Se tudo estiver bem, o script retorna `exit code 0`.
Se encontrar incidente, retorna `exit code 1`.
Se o proprio monitor falhar, retorna `exit code 2`.

## Configurar e-mail de alerta

O envio reaproveita o SMTP ja configurado no Uptech Sign.

Exemplo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1 -AlertEmails ops@seudominio.com.br
```

Voce pode informar mais de um destinatario:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1 -AlertEmails ops@seudominio.com.br,ti@seudominio.com.br
```

## Ajustar a janela maxima do backup

Se o backup diario roda de madrugada, uma janela de `30` horas costuma ser segura:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1 -MaxBackupAgeHours 30
```

## Pular checks especificos

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1 -SkipFrontend
powershell -ExecutionPolicy Bypass -File .\scripts\check-uptech-health.ps1 -SkipBackupAge
```

## Registrar tarefa agendada no Windows

Exemplo a cada `15` minutos:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-healthcheck-task.ps1 -EveryMinutes 15 -AlertEmails ops@seudominio.com.br
```

Parametros uteis:

- `-TaskName`
- `-EveryMinutes`
- `-AlertEmails`
- `-HealthUrl`
- `-FrontendUrl`
- `-MaxBackupAgeHours`
- `-SkipFrontend`
- `-SkipBackupAge`
- `-RunElevated`

## Remover a tarefa

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-healthcheck-task.ps1
```

## Comportamento dos alertas

- quando um problema aparece, o sistema envia um alerta
- se o mesmo problema continuar, o monitor evita spam por algumas horas
- quando o ambiente volta ao normal, ele envia um e-mail de recuperacao

## Recomendacao operacional

- rode o monitor a cada `15` minutos
- mantenha `AlertEmails` apontando para uma caixa acompanhada pelo escritorio ou pela TI
- use `SMTP` real antes de confiar nos alertas
- combine isso com backup diario e teste de restore periodico
