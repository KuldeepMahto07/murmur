' Starts the Fetchline tray app with no console window.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File """ & here & "\tray.ps1"""
CreateObject("WScript.Shell").Run cmd, 0, False
