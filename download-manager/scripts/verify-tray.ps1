# End-to-end check of the Windows tray app (desktop\tray.ps1) on a spare port with its
# own data folder, so a Fetchline you already run is not touched.
#   powershell -ExecutionPolicy Bypass -File scripts\verify-tray.ps1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Tray = Join-Path $Root 'desktop\tray.ps1'
$Port = 8797
$Data = Join-Path $Root 'data\tray-test'
$Log = Join-Path $Data 'tray.log'
$Base = "http://127.0.0.1:$Port/api"
$H = @{ 'X-Fetchline' = '1' }
$failures = 0
function Check([bool] $ok, [string] $what) {
  Write-Host ($(if ($ok) { '  PASS  ' } else { '  FAIL  ' }) + $what)
  if (-not $ok) { $script:failures++ }
}
function Ping { try { (Invoke-RestMethod "$Base/ping" -TimeoutSec 1).app -eq 'fetchline' } catch { $false } }
function LogText { if (Test-Path $Log) { Get-Content $Log -Raw } else { '' } }

if (Test-Path $Data) { Remove-Item -Recurse -Force $Data }

# 1. Start the tray hidden; it should start the engine without a window.
$proc = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', "`"$Tray`"", '-Port', "$Port", '-Data', "`"$Data`"")
for ($i = 0; $i -lt 60 -and -not (Ping); $i++) { Start-Sleep -Milliseconds 250 }
Check (Ping) 'tray started the engine'
$node = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*--port $Port*" }
Check ($node -and (Get-Process -Id $node.ProcessId).MainWindowHandle -eq 0) 'engine runs with no console window'
Start-Sleep -Seconds 2

# 2. Notifications for a finished and a failed download.
$add = { param($url) Invoke-RestMethod -Method POST "$Base/downloads" -Headers $H -ContentType 'application/json' -Body (@{ url = $url; start = 'now' } | ConvertTo-Json) | Out-Null }
& $add 'https://cdn.kernel.org/pub/linux/kernel/v6.x/sha256sums.asc'
& $add 'https://cdn.kernel.org/pub/linux/kernel/v6.x/does-not-exist.tar.xz'
for ($i = 0; $i -lt 40 -and ((LogText) -notmatch 'notify completed' -or (LogText) -notmatch 'notify error'); $i++) { Start-Sleep -Milliseconds 500 }
Check ((LogText) -match 'notify completed: sha256sums.asc') 'notification shown for the finished download'
Check ((LogText) -match 'notify error: does-not-exist.tar.xz') 'notification shown for the failed download'

# 3. Shutting the engine down (as the web UI or another tool would) closes the tray.
Invoke-RestMethod -Method POST "$Base/shutdown" -Headers $H -ContentType 'application/json' -Body '{}' | Out-Null
$exited = $proc.WaitForExit(15000)
Check $exited 'tray exits when the engine shuts down'
if (-not $exited) { Stop-Process -Id $proc.Id -Force }
Check ((LogText) -match 'tray exited') 'tray cleaned up (icon removed, lock released)'

# 4. Start with Windows: create and remove the Startup shortcut (restores what was there).
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Fetchline.lnk'
$had = Test-Path $link
& powershell -NoProfile -ExecutionPolicy Bypass -File $Tray -Action enable-startup -Data $Data
$ok = Test-Path $link
if ($ok) { $target = (New-Object -ComObject WScript.Shell).CreateShortcut($link).Arguments }
Check ($ok -and $target -like '*Fetchline.vbs*') 'Start with Windows creates a Startup shortcut to Fetchline.vbs'
if (-not $had) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $Tray -Action disable-startup -Data $Data
  Check (-not (Test-Path $link)) 'turning it off removes the shortcut'
}

Write-Host $(if ($failures) { "`n$failures check(s) FAILED" } else { "`nALL CHECKS PASSED" })
exit $failures
