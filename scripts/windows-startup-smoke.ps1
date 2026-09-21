param(
    [Parameter(Mandatory = $true)]
    [string] $PublishDir
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $PublishDir).Path
$isolated = Join-Path $env:RUNNER_TEMP "AtmosScopeStartup-$PID"
$webViewProfile = Join-Path $env:LOCALAPPDATA 'AtmosScope\WebView2'
$principal = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$process = $null
$denied = $false

if (Test-Path $webViewProfile) { throw "Startup check requires a fresh WebView2 profile: $webViewProfile" }
Copy-Item -Path $source -Destination $isolated -Recurse

try {
    # Simulate the machine-wide install directory, which ordinary users cannot write to.
    & icacls $isolated /deny "${principal}:(WD,AD)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not make the install directory read-only' }
    $denied = $true

    $started = Get-Date
    $process = Start-Process -FilePath (Join-Path $isolated 'AtmosScope.exe') `
        -WorkingDirectory $isolated -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    $status = Join-Path $env:LOCALAPPDATA 'AtmosScope\startup-status.txt'
    while ([DateTime]::UtcNow -lt $deadline) {
        $process.Refresh()
        if ($process.HasExited) {
            Start-Sleep -Seconds 2
            try {
                Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $started.AddSeconds(-2) } `
                    -ErrorAction Stop | Where-Object {
                        $_.ProviderName -in @('.NET Runtime', 'Application Error') -and $_.Message -match 'AtmosScope'
                    } | Select-Object -First 5 | ForEach-Object {
                        Write-Host "Startup crash event $($_.Id) ($($_.ProviderName)):`n$($_.Message)"
                    }
            }
            catch { Write-Warning "Could not read Windows crash events: $_" }
            throw "Installed application exited during startup: $($process.ExitCode)"
        }
        if ((Test-Path $webViewProfile) -and (Test-Path $status) -and $process.MainWindowHandle -ne 0) {
            if ((Get-Content $status -Raw).Trim() -eq 'Navigating to ordinary weather') { break }
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Path $webViewProfile) -or -not (Test-Path $status) -or
        (Get-Content $status -Raw).Trim() -ne 'Navigating to ordinary weather') {
        if (Test-Path $status) { Write-Host "Application startup phase: $(Get-Content $status -Raw)" }
        $diagnostic = Join-Path $env:LOCALAPPDATA 'AtmosScope\startup-error.txt'
        if (Test-Path $diagnostic) { Write-Host "Application startup error:`n$(Get-Content $diagnostic -Raw)" }
        Write-Host "Window handle: $($process.MainWindowHandle); WebView2 directory exists: $(Test-Path $webViewProfile)"
        throw "WebView2 did not initialize in the writable user profile: $webViewProfile"
    }
    if ($process.MainWindowHandle -eq 0) { throw 'Application did not create a window' }
    Write-Host 'Installed application opened its window and initialized WebView2 from a read-only directory.'
}
finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    if ($denied) {
        & icacls $isolated /remove:d $principal | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not remove the temporary deny ACL' }
    }
    Remove-Item -Path $isolated -Recurse -Force -ErrorAction SilentlyContinue
}
