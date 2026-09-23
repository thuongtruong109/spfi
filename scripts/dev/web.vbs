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
Dim exec
Dim output
Dim i
Dim portFree
Dim serverReady

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)


' =========================================================
' FUNCTION: Get process information on PORT
' =========================================================

Function GetPortProcesses(port)

    Dim psCommand
    Dim execResult
    Dim result

    ' Get only TCP connections on exact port
    psCommand = "powershell -NoProfile -Command " & _
                """Get-NetTCPConnection -LocalPort " & port & _
                " -State Listen -ErrorAction SilentlyContinue | " & _
                " Select-Object -ExpandProperty OwningProcess"""

    Set execResult = shell.Exec(psCommand)

    result = execResult.StdOut.ReadAll

    GetPortProcesses = Trim(result)

End Function


' =========================================================
' FUNCTION: Check if PORT is free
' =========================================================

Function IsPortFree(port)

    Dim result

    result = GetPortProcesses(port)

    If result = "" Then
        IsPortFree = True
    Else
        IsPortFree = False
    End If

End Function


' =========================================================
' FUNCTION: Kill all processes on PORT
' =========================================================

Function KillPortProcesses(port)

    Dim pids
    Dim pidArray
    Dim pid
    Dim j
    Dim killCommand

    pids = GetPortProcesses(port)

    If pids = "" Then
        KillPortProcesses = True
        Exit Function
    End If

    ' PowerShell can return multiple PIDs
    pidArray = Split(pids, vbCrLf)

    For j = 0 To UBound(pidArray)

        pid = Trim(pidArray(j))

        If pid <> "" Then

            ' Avoid killing PID 0
            If IsNumeric(pid) Then

                If CLng(pid) > 0 Then

                    killCommand = "taskkill /F /PID " & pid

                    shell.Run _
                        "cmd /c " & killCommand, _
                        0, _
                        True

                End If

            End If

        End If

    Next

    KillPortProcesses = True

End Function


' =========================================================
' STEP 1
' CLEAN PORT 3000
' =========================================================

portFree = False

For i = 1 To KILL_RETRIES

    ' Check first
    If IsPortFree(PORT) Then

        portFree = True
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

    output = GetPortProcesses(PORT)

    MsgBox _
        "Không thể giải phóng port " & PORT & "." & vbCrLf & vbCrLf & _
        "PID vẫn đang LISTEN:" & vbCrLf & _
        output & vbCrLf & vbCrLf & _
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
