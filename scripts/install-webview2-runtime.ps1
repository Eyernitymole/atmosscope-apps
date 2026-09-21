$ErrorActionPreference = 'Stop'
$runtimeId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$paths = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$runtimeId",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$runtimeId"
)

function Get-RuntimeVersion {
    foreach ($path in $paths) {
        $version = Get-ItemPropertyValue -Path $path -Name pv -ErrorAction SilentlyContinue
        if ($version -and $version -ne '0.0.0.0') { return $version }
    }
    return $null
}

$version = Get-RuntimeVersion
if (-not $version) {
    $installer = Join-Path $env:RUNNER_TEMP 'MicrosoftEdgeWebview2Setup.exe'
    Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $installer
    $installation = Start-Process -FilePath $installer -ArgumentList '/silent', '/install' -Wait -PassThru
    if ($installation.ExitCode -ne 0) { throw "WebView2 Runtime installer failed: $($installation.ExitCode)" }
    $version = Get-RuntimeVersion
}
if (-not $version) { throw 'WebView2 Runtime was not detected after installation' }
Write-Host "WebView2 Runtime is available: $version"
