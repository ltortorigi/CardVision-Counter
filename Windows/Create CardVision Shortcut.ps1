$ErrorActionPreference = "Stop"

$WindowsFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $WindowsFolder
$Target = Join-Path $WindowsFolder "2 - START CARDVISION.bat"
$Icon = Join-Path $Root "App\assets\windows_chip.ico"
$Desktop = [Environment]::GetFolderPath("Desktop")
$FolderShortcut = Join-Path $WindowsFolder "CardVision Counter Dev.lnk"
$DesktopShortcut = Join-Path $Desktop "CardVision Counter Dev.lnk"

$Shell = New-Object -ComObject WScript.Shell

function Make-Shortcut([string]$Path) {
    $Shortcut = $Shell.CreateShortcut($Path)
    $Shortcut.TargetPath = $Target
    $Shortcut.WorkingDirectory = $Root
    $Shortcut.IconLocation = "$Icon,0"
    $Shortcut.Description = "Launch CardVision Counter"
    $Shortcut.Save()
}

Make-Shortcut $FolderShortcut
Make-Shortcut $DesktopShortcut
