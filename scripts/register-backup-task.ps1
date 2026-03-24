[CmdletBinding()]
param(
    [string]$TaskName = "Uptech Sign - Backup Diario",
    [string]$DailyAt = "02:00",
    [int]$RetentionDays = 14,
    [string]$OutputDir = "",
    [string]$LogDir = "",
    [switch]$RunElevated
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backupScriptPath = Join-Path $projectRoot "scripts\backup-uptech-sign.ps1"

if (!(Test-Path $backupScriptPath)) {
    throw "Script de backup nao encontrado em $backupScriptPath"
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $projectRoot "backups"
}

if ([string]::IsNullOrWhiteSpace($LogDir)) {
    $LogDir = Join-Path $OutputDir "logs"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

try {
    $triggerTime = [datetime]::ParseExact($DailyAt, "HH:mm", $null)
}
catch {
    throw "Horario invalido. Use o formato HH:mm, por exemplo 02:00."
}

$taskArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$backupScriptPath`"",
    "-OutputDir", "`"$OutputDir`"",
    "-LogDir", "`"$LogDir`"",
    "-RetentionDays", $RetentionDays
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgs
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
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

Write-Host "Tarefa registrada com sucesso."
Write-Host "Nome:" $TaskName
Write-Host "Horario diario:" $DailyAt
Write-Host "Retencao:" $RetentionDays "dia(s)"
Write-Host "Nivel de execucao:" $runLevel
