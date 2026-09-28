$deckPath = Join-Path $PSScriptRoot 'server.pid'
if (Test-Path -LiteralPath $deckPath) {
    $deckId = [int](Get-Content -LiteralPath $deckPath)
    $deckProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $deckId"
    if ($deckProcess -and $deckProcess.Name -match '^pythonw?[\d.]*\.exe$' -and $deckProcess.CommandLine -match 'server.py') {
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/action' -Method Post -ContentType 'application/json' -Body '{"action":"release_all"}' -TimeoutSec 3 | Out-Null
        } finally {
            Stop-Process -Id $deckId
        }
    }
}
