Option Explicit

' =========================================================
' CONFIG
' =========================================================

Const PORT = 3000
Const KILL_RETRIES = 10
Const KILL_WAIT_MS = 200
Const SERVER_TIMEOUT = 30

Dim shell, fso
Dim currentDir
Dim command
Dim i
Dim serverReady

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)


' =========================================================
' FUNCTION: Build a hidden PowerShell command
' =========================================================

Function HiddenPowerShell(script)

    HiddenPowerShell = _
        "powershell.exe " & _
        "-NoLogo " & _
        "-NoProfile " & _
        "-NonInteractive " & _
        "-WindowStyle Hidden " & _
        "-Command """ & script & """"

End Function


' =========================================================
' FUNCTION: Check if PORT is free
' =========================================================

Function IsPortFree(port)

    Dim psScript
    Dim exitCode

    psScript = _
        "$connections = @(Get-NetTCPConnection " & _
        "-LocalPort " & port & " " & _
        "-State Listen " & _
        "-ErrorAction SilentlyContinue); " & _
        "if ($connections.Count -eq 0) { exit 0 }; " & _
        "exit 1"

    exitCode = shell.Run( _
        HiddenPowerShell(psScript), _
        0, _
        True _
    )

    IsPortFree = (exitCode = 0)

End Function


' =========================================================
' FUNCTION: Kill all processes on PORT
' =========================================================

Sub KillPortProcesses(port)

    Dim psScript

    psScript = _
        "Get-NetTCPConnection " & _
        "-LocalPort " & port & " " & _
        "-State Listen " & _
        "-ErrorAction SilentlyContinue | " & _
        "Select-Object -ExpandProperty OwningProcess -Unique | " & _
        "Where-Object { $_ -gt 0 -and $_ -ne $PID } | " & _
        "ForEach-Object { " & _
        "Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue " & _
        "}"

    shell.Run _
        HiddenPowerShell(psScript), _
        0, _
        True

End Sub


' =========================================================
' STEP 1
' CLEAN PORT 3000
' =========================================================

For i = 1 To KILL_RETRIES

    ' Check first
    If IsPortFree(PORT) Then

        Exit For

    End If

    ' Port occupied → kill processes
    KillPortProcesses PORT

    ' Very short wait for Windows to release socket
    WScript.Sleep KILL_WAIT_MS

Next


' =========================================================
' STEP 2
' FINAL PORT CHECK
' =========================================================

If Not IsPortFree(PORT) Then

    MsgBox _
        "Không thể giải phóng port " & PORT & "." & vbCrLf & vbCrLf & _
        "Vẫn còn process đang LISTEN trên port này." & vbCrLf & vbCrLf & _
        "npm run dev sẽ không được chạy.", _
        vbCritical, _
        "Port " & PORT & " đang bị chiếm"

    WScript.Quit 1

End If


' =========================================================
' STEP 3
' START DEV SERVER
' =========================================================

command = _
    "cmd /k " & _
    "cd /d """ & currentDir & """ && " & _
    "npm run dev"

shell.Run command, 1, False


' =========================================================
' STEP 4
' WAIT UNTIL SERVER IS READY
' =========================================================

serverReady = False

For i = 1 To SERVER_TIMEOUT

    WScript.Sleep 1000

    If Not IsPortFree(PORT) Then

        serverReady = True
        Exit For

    End If

Next


' =========================================================
' STEP 5
' OPEN BROWSER
' =========================================================

If serverReady Then

    shell.Run _
        "http://localhost:" & PORT, _
        1, _
        False

Else

    MsgBox _
        "npm run dev đã được khởi động nhưng server" & vbCrLf & _
        "không LISTEN trên port " & PORT & _
        " sau " & SERVER_TIMEOUT & " giây.", _
        vbExclamation, _
        "Dev Server chưa sẵn sàng"

End If
