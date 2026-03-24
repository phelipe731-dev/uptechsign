[CmdletBinding()]
param(
    [string]$TaskName = "Uptech Sign - Backup Diario"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Tarefa removida com sucesso:" $TaskName
}
else {
    Write-Host "Nenhuma tarefa encontrada com esse nome:" $TaskName
}
