; Harbor installer (Inno Setup 6). Built by scripts/build-installer.ts, which passes:
;   /DAppVersion=x.y.z  /DStageDir=<staged app files>  /DOutDir=<output folder>
; Per-user install (no admin prompt) into %LOCALAPPDATA%\Programs\Harbor.
; User data (%APPDATA%\Harbor) and downloads are never removed by uninstall or upgrade.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
; A test build (/DTestBuild, from scripts/verify-installer.ps1) gets its own AppId,
; name, default folder and shortcuts, so it can never collide with or clobber a real install.
#ifdef TestBuild
  #define AppIdFull "{{A1B2C3D4-7777-4777-8777-000000000001}"
  #define NameSuffix " (Test)"
  #define OutputBase "Harbor-Setup-test"
#else
  #define AppIdFull "{{6E0D5B2A-6B1F-4E8C-9C1B-4A7E2F1D3C55}"
  #define NameSuffix ""
  #define OutputBase "Harbor-Setup-" + AppVersion
#endif

[Setup]
AppId={#AppIdFull}
AppName=Harbor{#NameSuffix}
AppVersion={#AppVersion}
AppVerName=Harbor{#NameSuffix} {#AppVersion}
AppPublisher=Harbor
AppComments=Fast, crash-proof, verified downloads
DefaultDirName={localappdata}\Programs\Harbor{#NameSuffix}
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
OutputDir={#OutDir}
OutputBaseFilename={#OutputBase}
SetupIconFile={#StageDir}\harbor.ico
UninstallDisplayIcon={app}\harbor.ico
UninstallDisplayName=Harbor{#NameSuffix}
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
Name: "{userprograms}\Harbor{#NameSuffix}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Comment: "Harbor download manager"
Name: "{userdesktop}\Harbor{#NameSuffix}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Tasks: desktopicon
; Same name/place as the tray's own "Start with Windows" switch, so both control one shortcut.
Name: "{userstartup}\Harbor{#NameSuffix}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\desktop\Harbor.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\harbor.ico"; Tasks: startup

[Run]
; winget is a Windows "app execution alias" that Inno's file check can't see, so launch it through cmd.
Filename: "{cmd}"; Parameters: "/c winget install --id yt-dlp.yt-dlp -e --scope user --silent --accept-source-agreements --accept-package-agreements --disable-interactivity"; StatusMsg: "Setting up video-site support…"; Flags: runhidden waituntilterminated; Tasks: videosites
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
