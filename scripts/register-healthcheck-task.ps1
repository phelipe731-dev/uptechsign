[CmdletBinding()]
param(
    [string]$TaskName = "Uptech Sign - Monitoramento",
    [int]$EveryMinutes = 15,
    [double]$MaxBackupAgeHours = 30,
    [string]$AlertEmails = "",
    [string]$HealthUrl = "http://localhost:8000/api/health",
    [string]$FrontendUrl = "http://localhost:3000/",
    [switch]$SkipFrontend,
    [switch]$SkipBackupAge,
    [switch]$RunElevated
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($EveryMinutes -lt 5) {
    throw "Use intervalo minimo de 5 minutos para o monitoramento."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$checkScriptPath = Join-Path $projectRoot "scripts\check-uptech-health.ps1"

if (!(Test-Path $checkScriptPath)) {
    throw "Script de monitoramento nao encontrado em $checkScriptPath"
}

$taskArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$checkScriptPath`"",
    "-HealthUrl", "`"$HealthUrl`"",
    "-FrontendUrl", "`"$FrontendUrl`"",
    "-MaxBackupAgeHours", $MaxBackupAgeHours
)

if (-not [string]::IsNullOrWhiteSpace($AlertEmails)) {
    $taskArgs += @("-AlertEmails", "`"$AlertEmails`"")
}

if ($SkipFrontend) {
    $taskArgs += "-SkipFrontend"
}

if ($SkipBackupAge) {
    $taskArgs += "-SkipBackupAge"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($taskArgs -join " ")
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
$runLevel = if ($RunElevated) { "Highest" } else { "Limited" }
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel $runLevel

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "Tarefa de monitoramento registrada com sucesso."
Write-Host "Nome:" $TaskName
Write-Host "Intervalo:" "$EveryMinutes minuto(s)"
Write-Host "Backup maximo:" "$MaxBackupAgeHours hora(s)"
Write-Host "Alertas:" $(if ($AlertEmails) { $AlertEmails } else { "desativados" })
Write-Host "Nivel de execucao:" $runLevel
