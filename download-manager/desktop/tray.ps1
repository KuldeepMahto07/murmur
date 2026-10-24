# Harbor tray app (Windows). Runs the engine without a console window, adds a
# tray icon with a menu, and shows a notification when a download finishes or fails.
#
#   wscript desktop\Harbor.vbs                   # normal start (no console flash)
#   powershell -File desktop\tray.ps1 -Action enable-startup | disable-startup
param(
  [ValidateSet('run', 'enable-startup', 'disable-startup')] [string] $Action = 'run',
  [int] $Port = 8765,
  # Engine data folder. Default: %APPDATA%\Harbor when installed, download-manager\data from source.
  [string] $Data = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Base = "http://127.0.0.1:$Port"
# Installed builds ship their own Node runtime next to the app files.
$BundledNode = Join-Path $Root 'node\node.exe'
$Installed = Test-Path $BundledNode
$DataDir = if ($Data) { [IO.Path]::GetFullPath($Data) } elseif ($Installed) { Join-Path $env:APPDATA 'Harbor' } else { Join-Path $Root 'data' }
$Log = Join-Path $DataDir 'tray.log'
$StartupLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'Harbor.lnk'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Write-Log([string] $msg) { Add-Content -Path $Log -Value "$(Get-Date -Format s) $msg" -Encoding UTF8 }

function Set-Startup([bool] $on) {
  if ($on) {
    $sh = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($StartupLink)
    $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $lnk.Arguments = '"' + (Join-Path $PSScriptRoot 'Harbor.vbs') + '"'
    $lnk.WorkingDirectory = $Root
    $lnk.Description = 'Harbor download manager'
    $lnk.Save()
  } elseif (Test-Path $StartupLink) { Remove-Item $StartupLink }
  Write-Log "start with Windows: $on"
}

if ($Action -eq 'enable-startup') { Set-Startup $true; return }
if ($Action -eq 'disable-startup') { Set-Startup $false; return }

# ---- one tray per user
$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\FetchlineTray-$Port", [ref] $created)
if (-not $created) {
  # A tray that is shutting down still holds the lock for a moment; wait for it before giving up.
  $acquired = $false
  try { $acquired = $mutex.WaitOne(8000) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) { Write-Log 'tray already running; opening UI'; Start-Process $Base; return }
}

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

# The pairing token (first-party native caller), so tray menu actions work even when
# the user turns on "Require browser pairing". Read from the engine's data folder.
$PairToken = try { (Get-Content (Join-Path $DataDir 'pairing.json') -Raw | ConvertFrom-Json).token } catch { $null }
function Invoke-Api([string] $method, [string] $path) {
  $h = @{ 'X-Fetchline' = '1' }
  if ($PairToken) { $h['X-Harbor-Token'] = $PairToken }
  if ($method -eq 'GET') { return Invoke-RestMethod -Uri "$Base/api$path" -TimeoutSec 3 }
  return Invoke-RestMethod -Method $method -Uri "$Base/api$path" -Headers $h -ContentType 'application/json' -Body '{}' -TimeoutSec 10
}
function Test-Engine { try { return (Invoke-Api GET '/ping').app -eq 'fetchline' } catch { return $false } }

# ---- engine: reuse a running one, otherwise start it hidden
if (-not (Test-Engine)) {
  $node = if ($Installed) { $BundledNode } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
  if (-not $node) {
    [System.Windows.Forms.MessageBox]::Show('Node.js 24+ is required to run Harbor.', 'Harbor') | Out-Null
    return
  }
  $main = Join-Path $Root 'engine\main.ts'
  $engineArgs = @('--disable-warning=ExperimentalWarning', "`"$main`"", '--port', "$Port", '--data', "`"$DataDir`"")
  if ($Installed) {
    # New installs download to the user's own Downloads\Harbor folder.
    $downloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path
    $engineArgs += @('--downloads', "`"$(Join-Path $downloads 'Harbor')`"")
  }
  Start-Process -FilePath $node -WindowStyle Hidden -WorkingDirectory $Root `
    -ArgumentList $engineArgs `
    -RedirectStandardOutput (Join-Path $DataDir 'engine.log') -RedirectStandardError (Join-Path $DataDir 'engine.err.log')
  $up = $false
  for ($i = 0; $i -lt 50 -and -not $up; $i++) { Start-Sleep -Milliseconds 200; $up = Test-Engine }
  if (-not $up) {
    Write-Log 'engine failed to start'
    [System.Windows.Forms.MessageBox]::Show("The Harbor engine did not start.`nSee $DataDir\engine.err.log", 'Harbor') | Out-Null
    return
  }
  Write-Log 'engine started'
} else { Write-Log 'attached to running engine' }

# ---- tray icon and menu
$iconPath = Join-Path $Root 'extension\icons\harbor-32.png'
# Load from bytes so the PNG file isn't kept open (and locked) while the tray runs.
$bmp = New-Object System.Drawing.Bitmap (New-Object System.IO.MemoryStream (,[System.IO.File]::ReadAllBytes($iconPath)))
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$tray.Text = 'Harbor'
$tray.Visible = $true

# Run() with a context (not bare) so ExitThread() reliably ends the loop from timer/menu events.
$ctx = New-Object System.Windows.Forms.ApplicationContext
$menu = New-Object System.Windows.Forms.ContextMenuStrip
function Add-Item([string] $text, [scriptblock] $onClick) {
  $item = $menu.Items.Add($text)
  $item.add_Click($onClick)
  return $item
}
$open = Add-Item 'Open Harbor' { Start-Process $Base }
$open.Font = New-Object System.Drawing.Font($open.Font, [System.Drawing.FontStyle]::Bold)
$queueItem = Add-Item 'Start queue' {
  try { $s = Invoke-Api GET '/state'; Invoke-Api POST ($(if ($s.queueRunning) { '/queue/stop' } else { '/queue/start' })) | Out-Null } catch { Write-Log "queue: $_" }
}
Add-Item 'Pause all' { try { Invoke-Api POST '/pause-all' | Out-Null } catch { Write-Log "pause-all: $_" } } | Out-Null
$menu.Items.Add('-') | Out-Null
$startup = Add-Item 'Start with Windows' { Set-Startup (-not (Test-Path $StartupLink)); $startup.Checked = Test-Path $StartupLink }
$startup.Checked = Test-Path $StartupLink
$menu.Items.Add('-') | Out-Null
$script:quitting = $false
Add-Item 'Quit Harbor' {
  $script:quitting = $true
  try { Invoke-Api POST '/shutdown' | Out-Null } catch {}
  Write-Log 'quit from tray'
  $ctx.ExitThread()
} | Out-Null
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Start-Process $Base })
$tray.add_BalloonTipClicked({ Start-Process $Base })

# ---- poll state: tooltip, queue label, notifications
$known = @{}
$script:first = $true
$script:misses = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.add_Tick({
  try {
    $s = Invoke-Api GET '/state'
    $script:misses = 0
  } catch {
    # The engine was shut down (e.g. from the web UI): close the tray too.
    if (++$script:misses -ge 3 -and -not $script:quitting) { $timer.Stop(); Write-Log 'engine gone; exiting tray'; $ctx.ExitThread() }
    return
  }
  $active = @($s.downloads | Where-Object { $_.status -eq 'downloading' })
  $speed = ($active | Measure-Object -Property speed -Sum).Sum
  $tip = if ($active.Count) { 'Harbor - {0} active, {1:N1} MB/s' -f $active.Count, ($speed / 1MB) } else { 'Harbor - idle' }
  $tray.Text = $tip.Substring(0, [Math]::Min(63, $tip.Length))
  $queueItem.Text = $(if ($s.queueRunning) { 'Stop queue' } else { 'Start queue' })
  foreach ($d in $s.downloads) {
    $prev = $known[$d.id]
    $known[$d.id] = $d.status
    if ($script:first -or $prev -eq $d.status) { continue }
    if ($d.status -eq 'completed') {
      $check = if ($d.checksum.match -eq $true) { ' - checksum verified' } else { '' }
      $tray.ShowBalloonTip(5000, 'Download complete', "$($d.fileName)$check", [System.Windows.Forms.ToolTipIcon]::Info)
      Write-Log "notify completed: $($d.fileName)"
    } elseif ($d.status -eq 'error') {
      $tray.ShowBalloonTip(5000, 'Download failed', "$($d.fileName): $($d.error)", [System.Windows.Forms.ToolTipIcon]::Warning)
      Write-Log "notify error: $($d.fileName): $($d.error)"
    }
  }
  $script:first = $false
})
$timer.Start()
Write-Log "tray running (pid $PID)"

[System.Windows.Forms.Application]::Run($ctx)
$timer.Stop()
$tray.Visible = $false
$tray.Dispose()
try { $mutex.ReleaseMutex() } catch {}
Write-Log 'tray exited'
