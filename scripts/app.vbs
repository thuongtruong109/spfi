Option Explicit

Dim shell, fso, currentDir, command, tauriExe

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

command = "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a"

shell.Run command, 0, True

command = "cmd /k cd /d """ & currentDir & """ && npm run dev"

shell.Run command, 1, False

WScript.Sleep 8000

tauriExe = currentDir & "\src-tauri\target\release\my-app.exe"

If fso.FileExists(tauriExe) Then
    shell.Run """" & tauriExe & """", 1, False
Else
    MsgBox "Không tìm thấy Tauri EXE:" & vbCrLf & tauriExe, 16, "Error"
End If
