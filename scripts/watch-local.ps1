<#
watch-local.ps1 (v4.112.0) - ONE tab replaces the 5-min Task Scheduler popup.
Keeps the local CatTS translator (127.0.0.1:59200) alive, quietly, in this tab.

  BEFORE: \CatTS-API-Watchdog fired powershell.exe every 5 min -> console flash,
          even with -WindowStyle Hidden (DISABLED, see docs/development/local-translate-watch.md).
  NOW:    open one tab, run `npm run local`, leave it all day. Zero popups:
          checks + lifts happen INSIDE this tab; the lifted uvicorn stays hidden.

Usage:
  npm run local                                          # watch forever, check every 30s
  powershell -File scripts/watch-local.ps1 -IntervalSec 60
  powershell -File scripts/watch-local.ps1 -Once        # single check (CI)
#>
param(
  [int]$IntervalSec = 30,
  [int]$Port = 0,
  [string]$CattsRoot = "",
  [switch]$Once
)
$ErrorActionPreference = "Continue"
if ($Port -le 0) { $Port = if ($env:CATTS_API_PORT) { [int]$env:CATTS_API_PORT } else { 59200 } }
if (-not $CattsRoot) { $CattsRoot = if ($env:CATTS_ROOT) { $env:CATTS_ROOT } else { "E:\zengatrivi-drive-e\catts" } }
$LogDir = Join-Path $CattsRoot "data\cloud_agents"
$Py = Join-Path $CattsRoot ".venv\Scripts\python.exe"
$LogFile = Join-Path $LogDir "watch-local.log"

function Log([string]$msg) {
  $line = "$(Get-Date -Format 'HH:mm:ss') $msg"
  Write-Host $line
  try { Add-Content -LiteralPath $LogFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

function Get-Health {
  try { return Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 5 }
  catch { return $null }
}

function Lift-Api {
  # Same lift as catts scripts/lift_catintassist.ps1, but INLINE: no child window ever.
  if (-not (Test-Path -LiteralPath $Py)) { Log "LIFT FAIL: missing .venv python: $Py"; return $false }
  Log "DOWN -> lifting hidden uvicorn on :$Port ..."
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $oldSkip = $env:CATTS_SKIP_STARTUP_BACKFILL
  $env:CATTS_SKIP_STARTUP_BACKFILL = "1"
  try {
    Start-Process -FilePath $Py -ArgumentList @("-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "$Port") `
      -WorkingDirectory $CattsRoot -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $LogDir "catintassist-api.log") `
      -RedirectStandardError (Join-Path $LogDir "catintassist-api.err.log") | Out-Null
  } finally {
    if ($null -eq $oldSkip) { Remove-Item Env:CATTS_SKIP_STARTUP_BACKFILL -ErrorAction SilentlyContinue }
    else { $env:CATTS_SKIP_STARTUP_BACKFILL = $oldSkip }
  }
  $deadline = (Get-Date).AddSeconds(60)
  $health = $null
  while (-not $health -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 1000; $health = Get-Health }
  if (-not $health) { Log "LIFT FAIL: still down after 60s, see catintassist-api.err.log"; return $false }
  try {
    $body = @{ text = "Please sit here."; from_lang = "en"; to_lang = "es" } | ConvertTo-Json -Compress
    $t = Invoke-RestMethod "http://127.0.0.1:$Port/stt/translate" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 30
    if (-not $t.text) { Log "LIFT WARN: up, but smoke translate empty"; return $true }
    Log "UP: http://127.0.0.1:$Port (smoke: $($t.text))"
  } catch { Log "LIFT WARN: up, smoke failed: $($_.Exception.Message)" }
  return $true
}

Log "watching 127.0.0.1:$Port every ${IntervalSec}s - Ctrl+C stops the watch (API keeps running)"
do {
  $h = Get-Health
  if ($h) { Log "ok (translate_ready=$($h.translate_ready))" }
  else { [void](Lift-Api) }
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSec
} while ($true)
