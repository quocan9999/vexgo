param(
    [Parameter(Mandatory = $true)][string]$ConfigFile
)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
foreach ($field in @('node', 'source', 'out', 'key', 'logDirectory')) {
    if (-not $config.$field) { throw "Missing config field: $field" }
}
$logDirectory = [System.IO.Path]::GetFullPath($config.logDirectory)
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logFile = Join-Path $logDirectory (Get-Date -Format 'yyyy-MM-dd-HHmmss-fff.log')
$entryPoint = Join-Path $PSScriptRoot 'vexgo-backup.mjs'
$backupArgs = @()
if ($config.cloudinaryEnvironment) {
    if (@('dev','test','prod') -notcontains $config.cloudinaryEnvironment -or -not $config.cloudinaryEnvFile -or -not (Test-Path -LiteralPath $config.cloudinaryEnvFile -PathType Leaf)) { throw 'Cloudinary requires a valid environment and private env file' }
    $backupArgs += '--env-file=' + [System.IO.Path]::GetFullPath($config.cloudinaryEnvFile)
}
$backupArgs += @($entryPoint, 'backup', '--source', $config.source, '--out', $config.out, '--key', $config.key)
if ($config.cloudinaryEnvironment) { $backupArgs += @('--cloudinary-environment', $config.cloudinaryEnvironment) }
if ($config.mirror) { $backupArgs += @('--mirror', $config.mirror) }
if ($config.keep) { $backupArgs += @('--keep', [string]$config.keep) }
if ($config.revision) { $backupArgs += @('--revision', $config.revision) }
# Native stderr can become ErrorRecord on Windows PowerShell 5.1. Capture it
# without aborting before the native exit code is saved. CLI emits safe JSON only.
$ErrorActionPreference = 'Continue'
& $config.node @backupArgs 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message }
    else { $_ }
} | Out-File -LiteralPath $logFile -Encoding utf8
$backupExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($null -eq $backupExit) { exit 1 }
exit $backupExit
