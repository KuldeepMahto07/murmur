# Asks every Harbor running from $AppDir to save and exit; force-closes what doesn't.
# Used by the installer (before an upgrade) and the uninstaller. Processes are matched by
# the install folder, so a Harbor started from anywhere else (e.g. a source checkout) is
# never touched, whatever port it uses.
param([Parameter(Mandatory)] [string] $AppDir)

$dir = [IO.Path]::GetFullPath($AppDir).TrimEnd('\')
function Engines { Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith("$dir\", 'OrdinalIgnoreCase') } }
function Trays { Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf("$dir\desktop\tray.ps1", [StringComparison]::OrdinalIgnoreCase) -ge 0 } }

# 1. Graceful: each engine saves its download list and exits.
foreach ($e in @(Engines)) {
  $port = if ($e.CommandLine -match '--port\s+(\d+)') { $Matches[1] } else { 8765 }
  try { Invoke-RestMethod -Method Post "http://127.0.0.1:$port/api/shutdown" -Headers @{ 'X-Fetchline' = '1' } -TimeoutSec 5 | Out-Null } catch {}
}
# 2. Wait for engines and trays (a tray exits a few seconds after its engine).
for ($i = 0; $i -lt 40 -and (@(Engines).Count + @(Trays).Count) -gt 0; $i++) { Start-Sleep -Milliseconds 250 }
# 3. Anything still running from this folder would block the file update/removal.
foreach ($p in @(Engines) + @(Trays)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
exit 0
