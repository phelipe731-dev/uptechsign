[CmdletBinding()]
param(
    [string]$TaskName = "Uptech Sign - Monitoramento"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$task = Get-ScheduledTask | Where-Object { $_.TaskName -eq $TaskName } | Select-Object -First 1

if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Tarefa removida com sucesso:" $TaskName
}
else {
    Write-Host "Nenhuma tarefa encontrada com esse nome:" $TaskName
}
