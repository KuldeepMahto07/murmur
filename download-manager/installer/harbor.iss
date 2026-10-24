; Harbor installer (Inno Setup 6). Built by scripts/build-installer.ts, which passes:
;   /DAppVersion=x.y.z  /DStageDir=<staged app files>  /DOutDir=<output folder>
; Per-user install (no admin prompt) into %LOCALAPPDATA%\Programs\Harbor.
; User data (%APPDATA%\Harbor) and downloads are never removed by uninstall or upgrade.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{6E0D5B2A-6B1F-4E8C-9C1B-4A7E2F1D3C55}
AppName=Harbor
AppVersion={#AppVersion}
AppVerName=Harbor {#AppVersion}
AppPublisher=Harbor
AppComments=Fast, crash-proof, verified downloads
DefaultDirName={localappdata}\Programs\Harbor
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
OutputDir={#OutDir}
OutputBaseFilename=Harbor-Setup-{#AppVersion}
SetupIconFile={#StageDir}\harbor.ico
UninstallDisplayIcon={app}\harbor.ico
UninstallDisplayName=Harbor
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
VersionInfoVersion={#AppVersion}
VersionInfoProductName=Harbor

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
Name: "startup"; Description: "Start Harbor in the tray when I sign in"
Name: "videosites"; Description: "Video-site support (recommended; installs a free helper with winget, about 150 MB)"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Also extracted to {tmp} before installing, to stop a running copy during upgrades.
Source: "{#StageDir}\desktop\stop-harbor.ps1"; Flags: dontcopy

[Icons]
Name: "{userprograms}\Harbor"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Comment: "Harbor download manager"
Name: "{userdesktop}\Harbor"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Tasks: desktopicon
; Same name/place as the tray's own "Start with Windows" switch, so both control one shortcut.
Name: "{userstartup}\Harbor"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Tasks: startup

[Run]
Filename: "winget.exe"; Parameters: "install --id yt-dlp.yt-dlp -e --scope user --silent --accept-source-agreements --accept-package-agreements --disable-interactivity"; StatusMsg: "Setting up video-site support…"; Flags: runhidden waituntilterminated skipifdoesntexist; Tasks: videosites
Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; Description: "Open Harbor"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\desktop\stop-harbor.ps1"" -AppDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "StopHarbor"

[UninstallDelete]
; App folder only: settings, download list and downloads live elsewhere and are kept.
Type: filesandordirs; Name: "{app}"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  // Upgrade: ask a Harbor running from this install folder to save and exit first.
  ExtractTemporaryFile('stop-harbor.ps1');
  Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\stop-harbor.ps1') + '" -AppDir "' + ExpandConstant('{app}') + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
