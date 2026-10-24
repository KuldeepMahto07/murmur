# End-to-end check of dist\Harbor-Setup-<version>.exe:
# silent install to a temp folder -> launch the installed app on a spare port with its own
# data folder -> verified test download -> silent uninstall -> nothing left behind.
#   powershell -ExecutionPolicy Bypass -File scripts\verify-installer.ps1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $Root "dist\Harbor-Setup-$version.exe"
$appDir = Join-Path $env:TEMP 'harbor-install-test'
$data = Join-Path $env:TEMP 'harbor-install-test-data'
$port = 8798
$api = "http://127.0.0.1:$port/api"
$H = @{ 'X-Fetchline' = '1' }
$failures = 0
function Check([bool] $ok, [string] $what) {
  Write-Host ($(if ($ok) { '  PASS  ' } else { '  FAIL  ' }) + $what)
  if (-not $ok) { $script:failures++ }
}
function Ping { try { (Invoke-RestMethod "$api/ping" -TimeoutSec 1).app -eq 'fetchline' } catch { $false } }
$uninstKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{6E0D5B2A-6B1F-4E8C-9C1B-4A7E2F1D3C55}_is1'
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Harbor.lnk'

Check (Test-Path $setup) "installer exists ($([math]::Round((Get-Item $setup).Length / 1MB, 1)) MB)"
foreach ($p in $appDir, $data) { if (Test-Path $p) { Remove-Item -Recurse -Force $p } }

# 1. Silent install (no optional tasks: no desktop icon, no startup entry, no winget step).
$p = Start-Process $setup -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/DIR=`"$appDir`"", '/TASKS=""', "/LOG=`"$env:TEMP\harbor-install.log`"") -PassThru -Wait
Check ($p.ExitCode -eq 0) "silent install exit code $($p.ExitCode)"
foreach ($f in 'node\node.exe', 'node\LICENSE.txt', 'engine\main.ts', 'ui\index.html', 'desktop\Harbor.vbs', 'desktop\tray.ps1', 'extension\manifest.json', 'harbor.ico', 'unins000.exe') {
  Check (Test-Path (Join-Path $appDir $f)) "installed $f"
}
Check (Test-Path $startMenu) 'Start menu shortcut created'
$reg = Get-ItemProperty $uninstKey -ErrorAction SilentlyContinue
Check ($reg -and $reg.DisplayName -eq 'Harbor' -and $reg.DisplayVersion -eq $version) "listed in Apps & features as Harbor $version"

# 2. Run the installed app (bundled Node) on a spare port with a throwaway data folder.
$tray = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', "`"$appDir\desktop\tray.ps1`"", '-Port', "$port", '-Data', "`"$data`"")
for ($i = 0; $i -lt 60 -and -not (Ping); $i++) { Start-Sleep -Milliseconds 250 }
Check (Ping) 'installed Harbor started'
$node = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*--port $port*" }
Check ($node -and $node.ExecutablePath -like "$appDir\node\node.exe") "engine runs on the bundled Node ($($node.ExecutablePath))"
$state = Invoke-RestMethod "$api/state"
$downloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path
Check ($state.settings.baseDir -eq (Join-Path $downloads 'Harbor')) "new installs download to $($state.settings.baseDir)"
Check (((Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing).Content) -match '<title>Harbor</title>') 'UI served by the installed app'

$body = @{ url = 'https://cdn.kernel.org/pub/linux/kernel/v6.x/patch-6.6.1.xz'; checksum = 'sha256:39654b8d91e5c36544bc987a8ab353f53cdea738179155cd6eb7c992ba7f8c04'; start = 'now'; dir = (Join-Path $data 'dl') } | ConvertTo-Json
$d = Invoke-RestMethod -Method Post "$api/downloads" -Headers $H -ContentType 'application/json' -Body $body
for ($i = 0; $i -lt 40; $i++) { $s = (Invoke-RestMethod "$api/downloads/$($d.id)"); if ($s.status -in 'completed', 'error') { break }; Start-Sleep -Milliseconds 500 }
Check ($s.status -eq 'completed' -and $s.checksum.match -eq $true) 'test download completed and matched kernel.org SHA-256'

# 3. Upgrade in place while Harbor is running: the installer must stop it, replace files, keep data.
$p2 = Start-Process $setup -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/DIR=`"$appDir`"", '/TASKS=""') -PassThru -Wait
Check ($p2.ExitCode -eq 0) "upgrade over a running copy: exit code $($p2.ExitCode)"
Check (-not (Ping)) 'upgrade stopped the running engine first'
$tray.WaitForExit(15000) | Out-Null
Check ((Get-Content (Join-Path $data 'state.json') -Raw | ConvertFrom-Json).downloads.Count -ge 1) 'download list survived the upgrade'
$tray = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', "`"$appDir\desktop\tray.ps1`"", '-Port', "$port", '-Data', "`"$data`"")
for ($i = 0; $i -lt 60 -and -not (Ping); $i++) { Start-Sleep -Milliseconds 250 }
Check (Ping) 'upgraded Harbor starts again'

# 4. Silent uninstall: stops the running copy, removes app files, shortcut and Apps entry.
$u = Start-Process (Join-Path $appDir 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -PassThru -Wait
for ($i = 0; $i -lt 40 -and (Test-Path $appDir); $i++) { Start-Sleep -Milliseconds 500 }  # uninstaller finishes in a helper process
Check (-not (Ping)) 'uninstall stopped the running engine'
Check (-not (Test-Path $appDir)) 'app folder removed'
Check (-not (Test-Path $startMenu)) 'Start menu shortcut removed'
Check (-not (Test-Path $uninstKey)) 'Apps & features entry removed'
Check (Test-Path (Join-Path $data 'state.json')) 'user data folder kept'
$tray.WaitForExit(15000) | Out-Null
Check $tray.HasExited 'tray exited'

Remove-Item -Recurse -Force $data -ErrorAction SilentlyContinue
Write-Host $(if ($failures) { "`n$failures check(s) FAILED" } else { "`nALL CHECKS PASSED" })
exit $failures
