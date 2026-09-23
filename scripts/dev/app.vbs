Option Explicit

' =========================================================
' CONFIG
' =========================================================

Const PORT = 3000

Const KILL_RETRIES = 10
Const KILL_WAIT_MS = 200

Const SERVER_TIMEOUT = 30


' =========================================================
' VARIABLES
' =========================================================

Dim shell
Dim fso

Dim scriptDir
Dim projectDir
Dim tauriExe

Dim command

Dim i
Dim serverReady


' =========================================================
' INIT
' =========================================================

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' ---------------------------------------------------------
' Folder chứa app.vbs
'
' D:\Projects\shopify\spf\scripts\dev
' ---------------------------------------------------------

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)


' ---------------------------------------------------------
' Project directory
'
' D:\Projects\shopify\spf\scripts\dev
'              .. → D:\Projects\shopify\spf\scripts
'              .. → D:\Projects\shopify\spf
'              wrapper → D:\Projects\shopify\spf\wrapper
' ---------------------------------------------------------

projectDir = fso.GetAbsolutePathName( _
    scriptDir & "\..\..\wrapper" _
)


' ---------------------------------------------------------
' Tauri EXE
'
' D:\Projects\shopify\spf\wrapper\
' src-tauri\target\release\my-app.exe
' ---------------------------------------------------------

tauriExe = _
    projectDir & "\src-tauri\target\release\spfi.exe"


' =========================================================
' FUNCTION
' Build a PowerShell command that always runs without a visible window
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
' FUNCTION
' Check whether PORT is free
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
' FUNCTION
' Kill all processes listening on PORT
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

    ' Port đã free → đi tiếp ngay
    If IsPortFree(PORT) Then
        Exit For
    End If

    ' Kill tất cả process đang chiếm port
    KillPortProcesses PORT

    ' Cho Windows release socket
    WScript.Sleep KILL_WAIT_MS

Next


' =========================================================
' STEP 2
' FINAL PORT CHECK
' =========================================================

If Not IsPortFree(PORT) Then

    MsgBox _
        "Không thể giải phóng port " & PORT & "." & vbCrLf & vbCrLf & _
        "Vẫn còn process đang LISTEN trên port này.", _
        vbCritical, _
        "Port " & PORT & " đang bị chiếm"

    WScript.Quit 1

End If


' =========================================================
' STEP 3
' CHECK TAURI EXE
' =========================================================

If Not fso.FileExists(tauriExe) Then

    MsgBox _
        "Không tìm thấy Tauri EXE:" & vbCrLf & vbCrLf & _
        tauriExe & vbCrLf & vbCrLf & _
        "Project directory:" & vbCrLf & _
        projectDir, _
        vbCritical, _
        "Tauri EXE không tồn tại"

    WScript.Quit 1

End If


' =========================================================
' STEP 4
' START NUXT DEV SERVER
' =========================================================

command = _
    "cmd /k " & _
    "cd /d """ & projectDir & """ && " & _
    "npm run dev"

shell.Run _
    command, _
    1, _
    False


' =========================================================
' STEP 5
' WAIT UNTIL PORT 3000 IS LISTENING
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
' SERVER NOT READY
' =========================================================

If Not serverReady Then

    MsgBox _
        "Nuxt dev server đã được khởi động nhưng không" & vbCrLf & _
        "LISTEN trên port " & PORT & _
        " sau " & SERVER_TIMEOUT & " giây." & vbCrLf & vbCrLf & _
        "Project:" & vbCrLf & _
        projectDir & vbCrLf & vbCrLf & _
        "Tauri app sẽ không được mở.", _
        vbCritical, _
        "Dev Server chưa sẵn sàng"

    WScript.Quit 1

End If


' =========================================================
' STEP 7
' SERVER READY → OPEN TAURI APP
' =========================================================

shell.Run _
    """" & tauriExe & """", _
    1, _
    False
