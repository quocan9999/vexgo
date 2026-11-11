param(
    [Parameter(Mandatory = $true)][string]$ConfigFile,
    [string]$At = '02:00',
    [switch]$Preview
)
$ErrorActionPreference = 'Stop'
$configPath = (Resolve-Path -LiteralPath $ConfigFile).Path
if ($configPath.Contains('"')) { throw 'Invalid config path' }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
foreach ($field in @('node', 'source', 'out', 'key', 'logDirectory')) {
    if (-not $config.$field) { throw "Missing config field: $field" }
}
if (-not (Test-Path -LiteralPath $config.node -PathType Leaf)) { throw 'Node executable not found' }
if (-not (Test-Path -LiteralPath $config.key -PathType Leaf)) { throw 'Encryption key not found' }
$time = [datetime]::ParseExact($At, 'HH:mm', [System.Globalization.CultureInfo]::InvariantCulture)
$taskName = 'VexGo-MySQL-Backup'
$runner = Join-Path $PSScriptRoot 'run-scheduled.ps1'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $runner + '" -ConfigFile "' + $configPath + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'VexGo encrypted MySQL backup. Requires signed-in user and Docker Desktop. Logs in configured directory.'
if ($Preview) { $task | Export-ScheduledTask; exit 0 }
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'Task already exists; review it before changing its schedule' }
Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null
Write-Output "Registered $taskName daily at $At. Requires signed-in user and Docker running."
