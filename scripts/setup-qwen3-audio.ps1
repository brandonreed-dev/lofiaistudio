# LoFi AI Studio - Qwen3 Audio Wrapper Setup Script for Windows

Write-Host "=== LoFi AI Studio - Qwen3 Audio Setup ===" -ForegroundColor Cyan
Write-Host ""

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python was not found on PATH. Please install Python 3.11+ first." -ForegroundColor Red
    exit 1
}

$workspaceRoot = Get-Location
$toolsRoot = Join-Path $env:USERPROFILE "ai-tools"
$wrapperRoot = Join-Path $toolsRoot "qwen3-audio-wrapper"
$venvPath = Join-Path $wrapperRoot ".venv"
$envExamplePath = Join-Path $wrapperRoot ".env.example"

if (-not (Test-Path $toolsRoot)) {
    New-Item -ItemType Directory -Path $toolsRoot | Out-Null
}

if (-not (Test-Path $wrapperRoot)) {
    New-Item -ItemType Directory -Path $wrapperRoot | Out-Null
    Write-Host "Created wrapper workspace at $wrapperRoot" -ForegroundColor Green
} else {
    Write-Host "Wrapper workspace already exists at $wrapperRoot" -ForegroundColor Yellow
}

Write-Host "Creating virtual environment..." -ForegroundColor Yellow
python -m venv $venvPath

$pip = Join-Path $venvPath "Scripts\pip.exe"

Write-Host "Installing baseline wrapper dependencies..." -ForegroundColor Yellow
& $pip install --upgrade pip
& $pip install fastapi uvicorn[standard] transformers accelerate sentencepiece soundfile librosa

$envExample = @"
QWEN3_AUDIO_HOST=127.0.0.1
QWEN3_AUDIO_PORT=8001
QWEN3_ASR_MODEL=Qwen/Qwen2.5-Omni-7B
QWEN3_TTS_MODEL=Qwen/Qwen3-TTS
"@

Set-Content -Path $envExamplePath -Value $envExample

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Implement or drop in your Qwen3 audio wrapper app under $wrapperRoot" -ForegroundColor White
Write-Host "2. Start the wrapper on http://localhost:8001" -ForegroundColor White
Write-Host "3. Set QWEN3_AUDIO_ENDPOINT=http://localhost:8001 before starting LoFi AI Studio" -ForegroundColor White
Write-Host ""
Write-Host "Expected wrapper endpoints:" -ForegroundColor Cyan
Write-Host "  GET  /health" -ForegroundColor White
Write-Host "  GET  /models" -ForegroundColor White
Write-Host "  POST /transcribe" -ForegroundColor White
Write-Host "  POST /synthesize" -ForegroundColor White
