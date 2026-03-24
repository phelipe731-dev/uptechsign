[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupZipPath,
    [switch]$ValidateOnly,
    [switch]$KeepExtracted
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

function Restore-SnapshotDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Target,
        [Parameter(Mandatory = $true)]
        [string]$Suffix
    )

    if (!(Test-Path $Source)) {
        return $null
    }

    $rollbackPath = $null
    if (Test-Path $Target) {
        $rollbackPath = "$Target.__before_restore_$Suffix"
        if (Test-Path $rollbackPath) {
            Remove-Item -Path $rollbackPath -Recurse -Force
        }
        Move-Item -Path $Target -Destination $rollbackPath
    }

    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    Copy-Item -Path (Join-Path $Source "*") -Destination $Target -Recurse -Force -ErrorAction SilentlyContinue
    return $rollbackPath
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedBackupZip = Resolve-Path $BackupZipPath

Push-Location $projectRoot

try {
    $restoreStamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $extractRoot = Join-Path $projectRoot "backups"
    $extractDir = Join-Path $extractRoot "_restore_$restoreStamp"

    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    if (Test-Path $extractDir) {
        Remove-Item -Path $extractDir -Recurse -Force
    }

    Write-Host "Extraindo pacote..."
    Expand-Archive -Path $resolvedBackupZip -DestinationPath $extractDir -Force

    $manifestPath = Join-Path $extractDir "manifest.json"
    $databaseDumpPath = Join-Path $extractDir "database.dump"

    if (!(Test-Path $databaseDumpPath)) {
        throw "O pacote nao contem database.dump."
    }

    if ($ValidateOnly) {
        Write-Host "Pacote valido para restauracao."
        if (Test-Path $manifestPath) {
            Write-Host ""
            Get-Content $manifestPath
        }
        return
    }

    Write-Host "Parando frontend e backend..."
    Invoke-Compose -Arguments @("stop", "frontend", "backend")

    Write-Host "Subindo PostgreSQL..."
    Invoke-Compose -Arguments @("up", "-d", "postgres")
    Wait-PostgresReady

    $containerDumpPath = "/tmp/restore-uptech-sign.dump"

    Write-Host "Enviando dump para o container..."
    Invoke-Compose -Arguments @("cp", $databaseDumpPath, "postgres:$containerDumpPath")

    Write-Host "Recriando banco de dados..."
    Invoke-Compose -Arguments @(
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "detter",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'detter' AND pid <> pg_backend_pid();",
        "-c",
        "DROP DATABASE IF EXISTS detter;",
        "-c",
        "CREATE DATABASE detter WITH OWNER detter;"
    )

    Write-Host "Restaurando dump..."
    Invoke-Compose -Arguments @(
        "exec",
        "-T",
        "postgres",
        "pg_restore",
        "-U",
        "detter",
        "-d",
        "detter",
        "--no-owner",
        "--no-privileges",
        $containerDumpPath
    )
    Invoke-Compose -Arguments @("exec", "-T", "postgres", "rm", "-f", $containerDumpPath)

    $rollbackStorage = Restore-SnapshotDirectory -Source (Join-Path $extractDir "storage") -Target (Join-Path $projectRoot "storage") -Suffix $restoreStamp
    $rollbackTemplates = Restore-SnapshotDirectory -Source (Join-Path $extractDir "templates") -Target (Join-Path $projectRoot "templates") -Suffix $restoreStamp
    $rollbackCerts = Restore-SnapshotDirectory -Source (Join-Path $extractDir "certs") -Target (Join-Path $projectRoot "certs") -Suffix $restoreStamp

    Write-Host "Subindo backend e frontend..."
    Invoke-Compose -Arguments @("up", "-d", "backend", "frontend")

    Write-Host ""
    Write-Host "Restauracao concluida com sucesso."
    if ($rollbackStorage) {
        Write-Host "Snapshot anterior de storage:" $rollbackStorage
    }
    if ($rollbackTemplates) {
        Write-Host "Snapshot anterior de templates:" $rollbackTemplates
    }
    if ($rollbackCerts) {
        Write-Host "Snapshot anterior de certs:" $rollbackCerts
    }
}
finally {
    if (-not $KeepExtracted -and (Test-Path $extractDir)) {
        Remove-Item -Path $extractDir -Recurse -Force
    }
    Pop-Location
}
