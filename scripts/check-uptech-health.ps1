[CmdletBinding()]
param(
    [string]$HealthUrl = "http://localhost:8000/api/health",
    [string]$FrontendUrl = "http://localhost:3000/",
    [string]$BackupsDir = "",
    [double]$MaxBackupAgeHours = 30,
    [string]$AlertEmails = "",
    [string]$LogDir = "",
    [string]$StateDir = "",
    [int]$SuppressRepeatHours = 6,
    [switch]$SkipFrontend,
    [switch]$SkipBackupAge
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

function Load-State {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (!(Test-Path $Path)) {
        return [ordered]@{}
    }

    try {
        $content = Get-Content -Path $Path -Raw -Encoding utf8
        if ([string]::IsNullOrWhiteSpace($content)) {
            return [ordered]@{}
        }
        $loaded = $content | ConvertFrom-Json -AsHashtable
        if ($loaded -is [hashtable]) {
            return $loaded
        }
    }
    catch {
        Write-Log "Nao foi possivel ler o estado anterior do monitoramento: $($_.Exception.Message)" "WARN"
    }

    return [ordered]@{}
}

function Save-State {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Data
    )

    $parent = Split-Path -Parent $Path
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $Data | ConvertTo-Json -Depth 6 | Set-Content -Path $Path -Encoding utf8
}

function Get-StateValue {
    param(
        [Parameter(Mandatory = $true)][hashtable]$State,
        [Parameter(Mandatory = $true)][string]$Key
    )

    if ($State.Contains($Key)) {
        return $State[$Key]
    }

    return $null
}

function New-Issue {
    param(
        [Parameter(Mandatory = $true)][string]$Component,
        [Parameter(Mandatory = $true)][string]$Message
    )

    return [pscustomobject]@{
        component = $Component
        message   = $Message
    }
}

function Get-AlertFingerprint {
    param([Parameter(Mandatory = $true)][array]$Issues)

    $raw = ($Issues | Sort-Object component, message | ForEach-Object { "$($_.component):$($_.message)" }) -join "|"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "")
    }
    finally {
        $sha.Dispose()
    }
}

function Send-AlertEmail {
    param(
        [Parameter(Mandatory = $true)][string]$Subject,
        [Parameter(Mandatory = $true)][string]$BodyHtml
    )

    if ([string]::IsNullOrWhiteSpace($AlertEmails)) {
        Write-Log "Alertas por e-mail desativados: nenhum destinatario configurado." "WARN"
        return $false
    }

    $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
    $senderScript = Join-Path $projectRoot "scripts\send-ops-alert.py"
    if (!(Test-Path $senderScript)) {
        throw "Script de envio de alerta nao encontrado em $senderScript"
    }

    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("uptech-sign-alert-" + (Get-Date -Format "yyyyMMdd-HHmmssfff") + ".html")
    try {
        Set-Content -Path $tempFile -Value $BodyHtml -Encoding utf8
        & py -3 $senderScript --to $AlertEmails --subject $Subject --body-html-file $tempFile
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao enviar alerta operacional por e-mail."
        }
        Write-Log "Alerta operacional enviado para: $AlertEmails"
        return $true
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-BackendHealth {
    param([Parameter(Mandatory = $true)][string]$Url)

    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
    }
    catch {
        return @{
            ok = $false
            payload = $null
            issues = @(
                (New-Issue -Component "backend" -Message "Falha ao consultar ${Url}: $($_.Exception.Message)")
            )
        }
    }

    $issues = @()
    if ($response.status -ne "ok") {
        $issues += New-Issue -Component "backend" -Message "Healthcheck retornou status '$($response.status)'."
    }

    if ($response.database -and -not $response.database.ok) {
        $dbError = if ($response.database.error) { $response.database.error } else { "erro nao informado" }
        $issues += New-Issue -Component "database" -Message "Banco de dados indisponivel: $dbError"
    }

    if ($response.storage) {
        if (-not $response.storage.documents) {
            $issues += New-Issue -Component "storage" -Message "Pasta de documentos indisponivel."
        }
        if (-not $response.storage.templates) {
            $issues += New-Issue -Component "storage" -Message "Pasta de templates indisponivel."
        }
        if (-not $response.storage.certificates) {
            $issues += New-Issue -Component "storage" -Message "Pasta de certificados indisponivel."
        }
    }

    return @{
        ok = ($issues.Count -eq 0)
        payload = $response
        issues = $issues
    }
}

function Test-FrontendAvailability {
    param([Parameter(Mandatory = $true)][string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 15 -UseBasicParsing
    }
    catch {
        return @{
            ok = $false
            issues = @(
                (New-Issue -Component "frontend" -Message "Falha ao consultar ${Url}: $($_.Exception.Message)")
            )
        }
    }

    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
        return @{
            ok = $false
            issues = @(
                (New-Issue -Component "frontend" -Message "Frontend respondeu com status HTTP $($response.StatusCode).")
            )
        }
    }

    return @{
        ok = $true
        issues = @()
    }
}

function Test-BackupFreshness {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][double]$MaxAgeHours
    )

    if (!(Test-Path $Path)) {
        return @{
            ok = $false
            latestBackup = $null
            issues = @(
                (New-Issue -Component "backup" -Message "Pasta de backups nao encontrada: $Path")
            )
        }
    }

    $latest = Get-ChildItem -Path $Path -File -Filter "uptech-sign-backup-*.zip" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latest) {
        return @{
            ok = $false
            latestBackup = $null
            issues = @(
                (New-Issue -Component "backup" -Message "Nenhum pacote de backup encontrado em $Path")
            )
        }
    }

    $ageHours = ((Get-Date) - $latest.LastWriteTime).TotalHours
    $issues = @()
    if ($ageHours -gt $MaxAgeHours) {
        $issues += New-Issue -Component "backup" -Message "Ultimo backup com $([math]::Round($ageHours, 1)) hora(s) de idade: $($latest.Name)"
    }

    return @{
        ok = ($issues.Count -eq 0)
        latestBackup = [pscustomobject]@{
            name = $latest.Name
            path = $latest.FullName
            last_write_time = $latest.LastWriteTime.ToString("o")
            age_hours = [math]::Round($ageHours, 2)
            size_bytes = $latest.Length
        }
        issues = $issues
    }
}

function Build-AlertBody {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$Summary,
        [Parameter(Mandatory = $true)][array]$Issues,
        [Parameter(Mandatory = $false)]$HealthPayload,
        [Parameter(Mandatory = $false)]$LatestBackup
    )

    $issueItems = if ($Issues.Count -gt 0) {
        ($Issues | ForEach-Object {
            "<li><strong>$($_.component)</strong>: $($_.message)</li>"
        }) -join ""
    }
    else {
        "<li>Nenhum incidente ativo.</li>"
    }

    $healthDetails = ""
    if ($HealthPayload) {
        $healthDetails = @"
<p style="margin:16px 0 0;color:#374151;font-size:13px;">
  Ambiente: <strong>$($HealthPayload.environment)</strong><br>
  Health status: <strong>$($HealthPayload.status)</strong><br>
  Assinatura institucional configurada: <strong>$(if ($HealthPayload.institutional_signature_configured) { "sim" } else { "nao" })</strong><br>
  Base URL: <strong>$($HealthPayload.base_url)</strong>
</p>
"@
    }

    $backupDetails = ""
    if ($LatestBackup) {
        $backupDetails = @"
<p style="margin:16px 0 0;color:#374151;font-size:13px;">
  Ultimo backup: <strong>$($LatestBackup.name)</strong><br>
  Gerado em: <strong>$($LatestBackup.last_write_time)</strong><br>
  Idade aproximada: <strong>$($LatestBackup.age_hours) hora(s)</strong>
</p>
"@
    }

    return @"
<p><strong>$Title</strong></p>
<p>$Summary</p>
<ul style="padding-left:20px;color:#111827;">
  $issueItems
</ul>
$healthDetails
$backupDetails
<p style="margin-top:18px;color:#6b7280;font-size:12px;">
  Monitor gerado automaticamente em $(Get-Date -Format "dd/MM/yyyy HH:mm:ss") no host $env:COMPUTERNAME.
</p>
"@
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot

try {
    if ([string]::IsNullOrWhiteSpace($BackupsDir)) {
        $BackupsDir = Join-Path $projectRoot "backups"
    }

    if ([string]::IsNullOrWhiteSpace($LogDir)) {
        $LogDir = Join-Path $projectRoot "ops\logs"
    }

    if ([string]::IsNullOrWhiteSpace($StateDir)) {
        $StateDir = Join-Path $projectRoot "ops\state"
    }

    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

    $script:LogFilePath = Join-Path $LogDir ("monitor-" + (Get-Date -Format "yyyyMMdd") + ".log")
    $statePath = Join-Path $StateDir "monitor-state.json"
    $state = Load-State -Path $statePath

    Write-Log "Iniciando verificacao operacional do Uptech Sign"

    $issues = @()
    $backendResult = Test-BackendHealth -Url $HealthUrl
    $issues += $backendResult.issues

    $frontendResult = @{ ok = $true; issues = @() }
    if (-not $SkipFrontend) {
        $frontendResult = Test-FrontendAvailability -Url $FrontendUrl
        $issues += $frontendResult.issues
    }

    $backupResult = @{ ok = $true; latestBackup = $null; issues = @() }
    if (-not $SkipBackupAge) {
        $backupResult = Test-BackupFreshness -Path $BackupsDir -MaxAgeHours $MaxBackupAgeHours
        $issues += $backupResult.issues
    }

    if ($issues.Count -eq 0) {
        Write-Log "Monitoramento concluido sem incidentes."

        if ((Get-StateValue -State $state -Key "last_status") -eq "degraded" -and -not [string]::IsNullOrWhiteSpace($AlertEmails)) {
            $recoverySubject = "[Uptech Sign] Recuperacao detectada em $env:COMPUTERNAME"
            $recoveryBody = Build-AlertBody `
                -Title "Servico restabelecido" `
                -Summary "Os checks de backend, frontend e backup voltaram ao estado esperado." `
                -Issues @() `
                -HealthPayload $backendResult.payload `
                -LatestBackup $backupResult.latestBackup
            try {
                Send-AlertEmail -Subject $recoverySubject -BodyHtml $recoveryBody | Out-Null
            }
            catch {
                Write-Log "Falha ao enviar e-mail de recuperacao: $($_.Exception.Message)" "ERROR"
            }
        }

        $state.last_status = "ok"
        $state.last_ok_at = (Get-Date).ToString("o")
        $state.last_issue_fingerprint = ""
        Save-State -Path $statePath -Data $state
        exit 0
    }

    foreach ($issue in $issues) {
        Write-Log "$($issue.component): $($issue.message)" "WARN"
    }

    $fingerprint = Get-AlertFingerprint -Issues $issues
    $shouldSendAlert = $true
    $lastAlertAt = $null
    $stateLastAlertAt = Get-StateValue -State $state -Key "last_alert_at"
    if ($stateLastAlertAt) {
        try {
            $lastAlertAt = [datetime]::Parse($stateLastAlertAt)
        }
        catch {
            $lastAlertAt = $null
        }
    }

    if (
        (Get-StateValue -State $state -Key "last_issue_fingerprint") -eq $fingerprint -and
        $lastAlertAt -and
        $lastAlertAt -gt (Get-Date).AddHours(-$SuppressRepeatHours)
    ) {
        $shouldSendAlert = $false
        Write-Log "Incidente ja alertado recentemente. Novo e-mail suprimido por $SuppressRepeatHours hora(s)." "WARN"
    }

    if ($shouldSendAlert -and -not [string]::IsNullOrWhiteSpace($AlertEmails)) {
        $subject = "[Uptech Sign] Alerta operacional em $env:COMPUTERNAME"
        $body = Build-AlertBody `
            -Title "Incidente operacional detectado" `
            -Summary "O monitoramento automatico encontrou pelo menos um problema no ambiente." `
            -Issues $issues `
            -HealthPayload $backendResult.payload `
            -LatestBackup $backupResult.latestBackup
        try {
            Send-AlertEmail -Subject $subject -BodyHtml $body | Out-Null
            $state.last_alert_at = (Get-Date).ToString("o")
        }
        catch {
            Write-Log "Falha ao enviar alerta operacional: $($_.Exception.Message)" "ERROR"
        }
    }

    $state.last_status = "degraded"
    $state.last_issue_fingerprint = $fingerprint
    $state.last_check_at = (Get-Date).ToString("o")
    Save-State -Path $statePath -Data $state
    exit 1
}
catch {
    if (-not $script:LogFilePath) {
        $fallbackLogDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "ops\logs"
        New-Item -ItemType Directory -Force -Path $fallbackLogDir | Out-Null
        $script:LogFilePath = Join-Path $fallbackLogDir ("monitor-" + (Get-Date -Format "yyyyMMdd") + ".log")
    }
    Write-Log $_.Exception.Message "ERROR"
    exit 2
}
finally {
    Pop-Location
}
