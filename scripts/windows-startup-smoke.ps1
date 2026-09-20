param(
    [Parameter(Mandatory = $true)]
    [string] $PublishDir
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $PublishDir).Path
$controlDir = Join-Path $env:RUNNER_TEMP "AtmosScopeControl-$PID"
$isolated = Join-Path $env:RUNNER_TEMP "AtmosScopeStartup-$PID"
$webViewProfile = Join-Path $env:LOCALAPPDATA 'AtmosScope\WebView2'
$principal = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$process = $null
$controlProcess = $null
$denied = $false

if (Test-Path $webViewProfile) { throw "Startup check requires a fresh WebView2 profile: $webViewProfile" }
Copy-Item -Path $source -Destination $controlDir -Recurse
Copy-Item -Path $source -Destination $isolated -Recurse

try {
    # Prove that this runner can start WebView2 before reproducing an unwritable install.
    $controlProcess = Start-Process -FilePath (Join-Path $controlDir 'AtmosScope.exe') `
        -WorkingDirectory $controlDir -PassThru
    $controlState = Join-Path $controlDir 'AtmosScope.exe.WebView2\Local State'
    $controlDeadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $controlDeadline) {
        $controlProcess.Refresh()
        if ($controlProcess.HasExited) { throw "Writable-directory control exited during startup: $($controlProcess.ExitCode)" }
        if (Test-Path $controlState) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Path $controlState)) { throw 'Writable-directory control could not initialize WebView2' }
    Stop-Process -Id $controlProcess.Id -Force
    $controlProcess.WaitForExit()
    Write-Host 'Writable-directory control initialized WebView2.'

    # A machine-wide installer places the executable in a directory users cannot write to.
    & icacls $isolated /deny "${principal}:(WD,AD)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not make the install directory read-only' }
    $denied = $true

    $process = Start-Process -FilePath (Join-Path $isolated 'AtmosScope.exe') `
        -WorkingDirectory $isolated -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    $state = Join-Path $webViewProfile 'Local State'
    while ([DateTime]::UtcNow -lt $deadline) {
        $process.Refresh()
        if ($process.HasExited) { throw "Installed application exited during startup: $($process.ExitCode)" }
        if (Test-Path $state) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Path $state)) { throw "WebView2 did not initialize in the writable user profile: $state" }
    $process.Refresh()
    if ($process.HasExited) { throw "Installed application exited after WebView2 initialization: $($process.ExitCode)" }
    Write-Host 'Installed application started from a read-only directory with a writable WebView2 profile.'
}
finally {
    if ($controlProcess -and -not $controlProcess.HasExited) { Stop-Process -Id $controlProcess.Id -Force }
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    if ($denied) {
        & icacls $isolated /remove:d $principal | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not remove the temporary deny ACL' }
    }
    Remove-Item -Path $isolated -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $controlDir -Recurse -Force -ErrorAction SilentlyContinue
}
