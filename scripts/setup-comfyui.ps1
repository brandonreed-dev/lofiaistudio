# LoFi AI Studio - ComfyUI Setup Script for Windows
# Run this script in PowerShell

Write-Host "=== LoFi AI Studio - ComfyUI Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check for Python
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Python not found! Please install Python 3.10+ from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $pythonVersion" -ForegroundColor Green

# Check for Git
Write-Host "Checking Git installation..." -ForegroundColor Yellow
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git not found! Please install Git from https://git-scm.com/downloads" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $gitVersion" -ForegroundColor Green

# Create directory for AI tools
$aiToolsDir = "$env:USERPROFILE\AI-Tools"
if (-not (Test-Path $aiToolsDir)) {
    Write-Host "Creating AI-Tools directory at $aiToolsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $aiToolsDir | Out-Null
}

Set-Location $aiToolsDir

# Clone ComfyUI
$comfyDir = "$aiToolsDir\ComfyUI"
if (-not (Test-Path $comfyDir)) {
    Write-Host "Cloning ComfyUI..." -ForegroundColor Yellow
    git clone https://github.com/comfyanonymous/ComfyUI.git
} else {
    Write-Host "ComfyUI already exists at $comfyDir" -ForegroundColor Green
}

Set-Location $comfyDir

# Create virtual environment
$venvDir = "$comfyDir\venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$venvDir\Scripts\Activate.ps1"

# Install PyTorch with CUDA support
Write-Host "Installing PyTorch with CUDA 12.1 support..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install ComfyUI requirements
Write-Host "Installing ComfyUI requirements..." -ForegroundColor Yellow
pip install -r requirements.txt

# Create models directory if it doesn't exist
$checkpointsDir = "$comfyDir\models\checkpoints"
if (-not (Test-Path $checkpointsDir)) {
    New-Item -ItemType Directory -Path $checkpointsDir -Force | Out-Null
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Download a model (checkpoint) to: $checkpointsDir" -ForegroundColor White
Write-Host ""
Write-Host "Recommended models:" -ForegroundColor Yellow
Write-Host "  - SDXL Base: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0" -ForegroundColor White
Write-Host "  - SD 1.5: https://huggingface.co/runwayml/stable-diffusion-v1-5" -ForegroundColor White
Write-Host "  - SDXL Turbo: https://huggingface.co/stabilityai/sdxl-turbo" -ForegroundColor White
Write-Host ""
Write-Host "2. Start ComfyUI:" -ForegroundColor Cyan
Write-Host "   cd $comfyDir" -ForegroundColor White
Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "   python main.py --listen 0.0.0.0 --port 8188" -ForegroundColor White
Write-Host ""
Write-Host "3. LoFi AI Studio will auto-connect to ComfyUI on startup!" -ForegroundColor Green