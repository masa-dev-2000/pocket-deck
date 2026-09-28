$ErrorActionPreference = 'Stop'
$resultDirectory = 'C:\deck-results'
try {
    [System.IO.File]::WriteAllText("$resultDirectory\started.txt", [DateTime]::UtcNow.ToString('o'))
    Remove-Item -LiteralPath "$resultDirectory\result.json" -ErrorAction SilentlyContinue
    $oldUninstaller = Join-Path $env:LOCALAPPDATA 'Programs\Pocket Deck\Uninstall Pocket Deck.exe'
    if (Test-Path -LiteralPath $oldUninstaller) {
        Get-Process -Name 'Pocket Deck' -ErrorAction SilentlyContinue | Stop-Process
        Start-Sleep -Seconds 3
        $removed = Start-Process -FilePath $oldUninstaller -ArgumentList '/S','/currentuser' -PassThru -Wait -WindowStyle Hidden
        if ($removed.ExitCode -ne 0) { throw 'Guest test installation could not be reset' }
    }
    & 'C:\deck-node\node.exe' 'C:\deck-test\app\desktop\integration\sandbox-install.cjs' *> "$resultDirectory\install.log"
    if ($LASTEXITCODE -ne 0) { throw 'npm lifecycle installation failed' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { $config = Invoke-RestMethod 'http://127.0.0.1:8765/api/config' -TimeoutSec 2; $ready = $config.version -eq 4; if ($ready) { break } } catch {}
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Installed application did not start its backend' }
    # All these processes belong to this disposable guest, never to the host user's app.
    Get-Process -Name 'Pocket Deck' -ErrorAction SilentlyContinue | Stop-Process
    Start-Sleep -Seconds 4
    $dataDirectory = Join-Path $env:APPDATA 'Pocket Deck\data'
    $configPath = Join-Path $dataDirectory 'config.json'
    if (!(Test-Path -LiteralPath $configPath)) {
        [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 100), (New-Object System.Text.UTF8Encoding($false)))
    }
    $before = (Get-FileHash -LiteralPath $configPath).Hash
    [System.IO.File]::WriteAllText((Join-Path $dataDirectory 'update-test-sentinel.txt'), 'preserve this user data')
    $testApp = 'C:\deck-update-harness'
    New-Item -ItemType Directory -Path $testApp -Force | Out-Null
    Copy-Item -LiteralPath 'C:\deck-test\app\desktop\integration\sandbox-updater.cjs' -Destination "$testApp\main.cjs"
    [System.IO.File]::WriteAllText("$testApp\package.json", '{"name":"deck-update-test","version":"1.0.4","main":"main.cjs"}')
    [System.IO.File]::WriteAllText("$testApp\dev-app-update.yml", "provider: generic`nurl: http://127.0.0.1:18765/`n")
    $electron = Start-Process -FilePath 'C:\deck-test\app\desktop\node_modules\electron\dist\electron.exe' -ArgumentList $testApp -PassThru -WindowStyle Hidden
    $updated = $false
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        $installed = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\3ae32cde-c490-519a-b196-532e925bccdf' -ErrorAction SilentlyContinue
        if ($installed.DisplayVersion -eq '1.0.5') { $updated = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$updated) { throw 'Real NSIS update did not install version 1.0.5' }
    if ((Get-FileHash -LiteralPath $configPath).Hash -ne $before) { throw 'Configuration changed during update' }
    if ([System.IO.File]::ReadAllText((Join-Path $dataDirectory 'update-test-sentinel.txt')) -ne 'preserve this user data') { throw 'User data disappeared' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $config = Invoke-RestMethod 'http://127.0.0.1:8765/api/config' -TimeoutSec 2; $ready = $config.version -eq 4; if ($ready) { break } } catch {}
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Updated application did not restart its backend' }
    @{ success = $true; installed = '1.0.4'; updated = '1.0.5'; dataPreserved = $true; restarted = $true } | ConvertTo-Json | Set-Content -LiteralPath "$resultDirectory\result.json" -Encoding UTF8
} catch {
    @{ success = $false; error = $_.Exception.Message; position = $_.InvocationInfo.PositionMessage } | ConvertTo-Json | Set-Content -LiteralPath "$resultDirectory\result.json" -Encoding UTF8
}
