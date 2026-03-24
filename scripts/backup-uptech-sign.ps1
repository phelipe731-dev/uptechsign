[CmdletBinding()]
param(
    [string]$OutputDir = "",
    [switch]$KeepExpanded,
    [int]$RetentionDays = 14,
    [string]$LogDir = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    if ($script:LogFilePath) {
        Add-Content -Path $script:LogFilePath -Value $line -Encoding utf8
    }
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & docker compose @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar: docker compose $($Arguments -join ' ')"
    }
}

function Wait-PostgresReady {
    param(
        [int]$Attempts = 30,
        [int]$DelaySeconds = 2
    )

    for ($i = 0; $i -lt $Attempts; $i++) {
        & docker compose exec -T postgres pg_isready -U detter *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    throw "PostgreSQL nao ficou pronto a tempo."
}

function Copy-DirectorySnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (!(Test-Path $Source)) {
        return $false
    }

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force -ErrorAction SilentlyContinue
    return $true
}

function Remove-OldBackupArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,
        [Parameter(Mandatory = $true)]
        [int]$Days
    )

    if ($Days -lt 1 -or !(Test-Path $BasePath)) {
        return
    }

    $limit = (Get-Date).AddDays(-$Days)

    Get-ChildItem -Path $BasePath -File -Filter "uptech-sign-backup-*.zip" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $limit } |
        ForEach-Object {
            Write-Log "Removendo backup antigo: $($_.FullName)"
            Remove-Item -Path $_.FullName -Force
        }

    Get-ChildItem -Path $BasePath -Directory -Filter "uptech-sign-backup-*" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $limit } |
        ForEach-Object {
            Write-Log "Removendo pasta expandida antiga: $($_.FullName)"
            Remove-Item -Path $_.FullName -Recurse -Force
        }
}

function Remove-OldLogFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,
        [Parameter(Mandatory = $true)]
        [int]$Days
    )

    if ($Days -lt 1 -or !(Test-Path $BasePath)) {
        return
    }

    $limit = (Get-Date).AddDays(-$Days)

    Get-ChildItem -Path $BasePath -File -Filter "backup-*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $limit } |
        ForEach-Object {
            Remove-Item -Path $_.FullName -Force
        }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot

try {
    if ([string]::IsNullOrWhiteSpace($OutputDir)) {
        $OutputDir = Join-Path $projectRoot "backups"
    }

    if ([string]::IsNullOrWhiteSpace($LogDir)) {
        $LogDir = Join-Path $OutputDir "logs"
    }

    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $script:LogFilePath = Join-Path $LogDir "backup-$timestamp.log"

    Write-Log "Iniciando rotina de backup do Uptech Sign"
    Write-Log "Pasta de saida: $OutputDir"
    Write-Log "Retencao configurada: $RetentionDays dia(s)"

    $backupName = "uptech-sign-backup-$timestamp"
    $stagingDir = Join-Path $OutputDir $backupName
    $archivePath = Join-Path $OutputDir "$backupName.zip"
    $containerDumpPath = "/tmp/$backupName.dump"
    $localDumpPath = Join-Path $stagingDir "database.dump"

    if (Test-Path $stagingDir) {
        Remove-Item -Path $stagingDir -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

    Write-Log "Subindo PostgreSQL e aguardando healthcheck..."
    Invoke-Compose -Arguments @("up", "-d", "postgres")
    Wait-PostgresReady

    Write-Log "Gerando dump do banco..."
    Invoke-Compose -Arguments @("exec", "-T", "postgres", "sh", "-lc", "pg_dump -U detter -d detter -Fc -f $containerDumpPath")
    Invoke-Compose -Arguments @("cp", "postgres:$containerDumpPath", $localDumpPath)
    Invoke-Compose -Arguments @("exec", "-T", "postgres", "rm", "-f", $containerDumpPath)

    $copiedStorage = Copy-DirectorySnapshot -Source (Join-Path $projectRoot "storage") -Destination (Join-Path $stagingDir "storage")
    $copiedTemplates = Copy-DirectorySnapshot -Source (Join-Path $projectRoot "templates") -Destination (Join-Path $stagingDir "templates")
    $copiedCerts = Copy-DirectorySnapshot -Source (Join-Path $projectRoot "certs") -Destination (Join-Path $stagingDir "certs")

    $manifest = [ordered]@{
        app = "Uptech Sign"
        created_at = (Get-Date).ToString("o")
        backup_name = $backupName
        retention_days = $RetentionDays
        database = [ordered]@{
            file = "database.dump"
            sha256 = (Get-FileHash -Algorithm SHA256 -Path $localDumpPath).Hash
            size_bytes = (Get-Item $localDumpPath).Length
        }
        snapshots = [ordered]@{
            storage = $copiedStorage
            templates = $copiedTemplates
            certs = $copiedCerts
        }
        restore_notes = @(
            "Pare backend e frontend antes de restaurar.",
            "Use scripts/restore-uptech-sign.ps1 para restaurar este pacote."
        )
    }

    $manifestPath = Join-Path $stagingDir "manifest.json"
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding utf8

    if (Test-Path $archivePath) {
        Remove-Item -Path $archivePath -Force
    }

    Write-Log "Compactando pacote final..."
    Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $archivePath -CompressionLevel Optimal

    if (-not $KeepExpanded) {
        Remove-Item -Path $stagingDir -Recurse -Force
    }

    Remove-OldBackupArtifacts -BasePath $OutputDir -Days $RetentionDays
    Remove-OldLogFiles -BasePath $LogDir -Days $RetentionDays

    Write-Log "Backup concluido com sucesso."
    Write-Log "Arquivo final: $archivePath"
}
catch {
    Write-Log $_.Exception.Message "ERROR"
    throw
}
finally {
    Pop-Location
}
