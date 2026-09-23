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
Dim output
Dim i
Dim serverReady


' =========================================================
' INIT
' =========================================================

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)


' =========================================================
' FUNCTION: Get all PIDs listening on exact PORT
' =========================================================

Function GetPortProcesses(port)

    Dim psCommand
    Dim execResult
    Dim result

    psCommand = _
        "powershell -NoProfile -Command " & _
        """Get-NetTCPConnection " & _
        "-LocalPort " & port & _
        " -State Listen " & _
        "-ErrorAction SilentlyContinue | " & _
        "Select-Object -ExpandProperty OwningProcess"""

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

    IsPortFree = (result = "")

End Function


' =========================================================
' FUNCTION: Kill all processes on PORT
' =========================================================

Sub KillPortProcesses(port)

    Dim pids
    Dim pidArray
    Dim pid
    Dim j
    Dim killCommand

    pids = GetPortProcesses(port)

    If pids = "" Then
        Exit Sub
    End If

    pidArray = Split(pids, vbCrLf)

    For j = 0 To UBound(pidArray)

        pid = Trim(pidArray(j))

        If pid <> "" Then

            If IsNumeric(pid) Then

                If CLng(pid) > 0 Then

                    killCommand = _
                        "taskkill /F /PID " & pid

                    shell.Run _
                        "cmd /c " & killCommand, _
                        0, _
                        True

                End If

            End If

        End If

    Next

End Sub


' =========================================================
' STEP 1
' CLEAN PORT 3000
' =========================================================

For i = 1 To KILL_RETRIES

    ' Port đã free → thoát ngay
    If IsPortFree(PORT) Then
        Exit For
    End If

    ' Port đang bị chiếm → kill tất cả process
    KillPortProcesses PORT

    ' Cho Windows release socket
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
        "Server sẽ không được start.", _
        vbCritical, _
        "Port " & PORT & " đang bị chiếm"

    WScript.Quit 1

End If


' =========================================================
' STEP 3
' CHECK PRODUCTION SERVER FILE
' =========================================================

If Not fso.FileExists( _
    currentDir & "\.output\server\index.mjs" _
) Then

    MsgBox _
        "Không tìm thấy production server:" & vbCrLf & vbCrLf & _
        currentDir & "\.output\server\index.mjs" & vbCrLf & vbCrLf & _
        "Hãy chạy build trước.", _
        vbCritical, _
        "Production build không tồn tại"

    WScript.Quit 1

End If


' =========================================================
' STEP 4
' START PRODUCTION SERVER
' =========================================================

command = _
    "cmd /c cd /d """ & currentDir & """ && " & _
    "node .output\server\index.mjs"

shell.Run _
    command, _
    0, _
    False


' =========================================================
' STEP 5
' WAIT FOR SERVER
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
' STEP 6
' OPEN BROWSER
' =========================================================

If serverReady Then

    shell.Run _
        "http://localhost:" & PORT, _
        1, _
        False

Else

    MsgBox _
        "Production server đã được start nhưng không" & vbCrLf & _
        "LISTEN trên port " & PORT & _
        " sau " & SERVER_TIMEOUT & " giây." & vbCrLf & vbCrLf & _
        "Command:" & vbCrLf & _
        "node .output\server\index.mjs", _
        vbExclamation, _
        "Server chưa sẵn sàng"

End If
