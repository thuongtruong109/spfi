Option Explicit

Dim shell, fso, currentDir, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

command = "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a"

shell.Run command, 0, True

command = "cmd /k cd /d """ & currentDir & """ && npm run dev"

shell.Run command, 1, False

WScript.Sleep 8000

shell.Run "http://localhost:3000"
