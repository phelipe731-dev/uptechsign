# Backup e Restore - Uptech Sign

## Scripts disponiveis

- `scripts/backup-uptech-sign.ps1`
- `scripts/restore-uptech-sign.ps1`
- `scripts/register-backup-task.ps1`
- `scripts/unregister-backup-task.ps1`

## Gerar backup

Na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-uptech-sign.ps1
```

O script:

- garante que o PostgreSQL esta de pe
- gera `pg_dump` em formato custom
- copia `storage/`, `templates/` e `certs/`
- monta um pacote `.zip` em `backups/`
- grava log em `backups/logs/`
- aplica retencao automatica dos pacotes antigos

## Gerar backup e manter a pasta expandida

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-uptech-sign.ps1 -KeepExpanded
```

## Gerar backup com retencao personalizada

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-uptech-sign.ps1 -RetentionDays 30
```

## Validar um pacote antes de restaurar

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-uptech-sign.ps1 -BackupZipPath .\backups\SEU_ARQUIVO.zip -ValidateOnly
```

## Restaurar

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-uptech-sign.ps1 -BackupZipPath .\backups\SEU_ARQUIVO.zip
```

O script de restore:

- para `frontend` e `backend`
- garante que o `postgres` esta ativo
- recria o banco `detter`
- restaura o dump
- restaura `storage/`, `templates/` e `certs/`
- sobe `backend` e `frontend` de novo

## Registrar tarefa diaria no Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1 -DailyAt 02:00 -RetentionDays 14
```

Voce pode customizar:

- `-TaskName`
- `-DailyAt`
- `-RetentionDays`
- `-OutputDir`
- `-LogDir`
- `-RunElevated` somente se voce realmente quiser a tarefa em modo elevado

## Remover a tarefa agendada

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-backup-task.ps1
```

## Observacoes importantes

- O restore guarda a versao anterior de `storage/`, `templates/` e `certs/` com o sufixo `__before_restore_...`
- O backup nao inclui o arquivo `.env`
- Guarde backups fora da maquina principal quando for para producao
- Teste restore periodicamente
- Os logs do backup ficam em `backups/logs/`

## Recomendacao operacional

- backup diario do banco e `storage/`
- copia secundaria em outra maquina ou nuvem privada
- restore de teste pelo menos 1 vez por mes
