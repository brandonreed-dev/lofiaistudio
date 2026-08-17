# LoFi AI Studio - Image Model Setup Script for RTX 4070 Laptop (8GB VRAM)
# Supports FLUX.2 and Z-Image-Turbo
# Run this script in PowerShell

Write-Host "=== LoFi AI Studio - Image Model Setup ===" -ForegroundColor Cyan
Write-Host "Optimized for RTX 4070 Laptop (8GB VRAM)" -ForegroundColor Gray
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
    Set-Location $comfyDir
}

# Create virtual environment
$venvDir = "$comfyDir\venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$venvDir\Scripts\Activate.ps1"

# Install PyTorch with CUDA 12.1 support
Write-Host "Installing PyTorch with CUDA 12.1 support..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install ComfyUI requirements
Write-Host "Installing ComfyUI requirements..." -ForegroundColor Yellow
pip install -r requirements.txt

# Install FLUX-specific dependencies
Write-Host "Installing model dependencies..." -ForegroundColor Yellow
pip install bitsandbytes accelerate safetensors huggingface_hub sentencepiece

# Create model directories
$modelsDir = "$comfyDir\models"
$checkpointsDir = "$modelsDir\checkpoints"
$clipDir = "$modelsDir\clip"
$vaeDir = "$modelsDir\vae"
$unetDir = "$modelsDir\unet"
$llmDir = "$modelsDir\llm"

@($checkpointsDir, $clipDir, $vaeDir, $unetDir, $llmDir) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

Write-Host ""
Write-Host "=== Model Selection ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Which models would you like to install?" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. FLUX.2-dev (Best quality, ~12GB with FP8, needs 8GB+ VRAM)" -ForegroundColor White
Write-Host "  2. Z-Image-Turbo (Fast, low VRAM, ~4GB)" -ForegroundColor White
Write-Host "  3. Both models" -ForegroundColor White
Write-Host "  4. Skip model download (install ComfyUI only)" -ForegroundColor White
Write-Host ""

$selection = Read-Host "Enter your choice (1-4)"

# Create download script
$downloadScriptContent = @'
import os
import sys
from huggingface_hub import hf_hub_download, snapshot_download

def download_file(repo_id, filename, local_dir):
    print(f"Downloading {filename} from {repo_id}...")
    path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=local_dir,
        local_dir_use_symlinks=False
    )
    print(f"Saved to: {path}")
    return path

def download_repo(repo_id, local_dir, allow_patterns=None):
    print(f"Downloading {repo_id}...")
    snapshot_download(
        repo_id=repo_id,
        local_dir=local_dir,
        allow_patterns=allow_patterns,
        local_dir_use_symlinks=False
    )
    print(f"Saved to: {local_dir}")

# Model downloads based on selection
selection = __SELECTION__

if selection in ["1", "3"]:
    print("\n=== Downloading FLUX.2-dev ===")
    
    # FLUX.2 uses similar architecture to FLUX.1
    # Download FLUX.2-dev with FP8 quantization for 8GB VRAM
    try:
        # Try FLUX.2-dev FP8 from Kijai (quantized version)
        download_file(
            "Kijai/flux-fp8",
            "flux2-dev-fp8.safetensors",
            r"__CHECKPOINTS_DIR__"
        )
    except Exception as e:
        print(f"FLUX.2-dev FP8 not found, trying alternative...")
        # Fallback to FLUX.1-schnell which is confirmed available
        download_file(
            "Kijai/flux-fp8",
            "flux1-schnell-fp8.safetensors",
            r"__CHECKPOINTS_DIR__"
        )
        print("Note: Downloaded FLUX.1-schnell as FLUX.2 may not be available in FP8 yet")
    
    # Download CLIP models for FLUX
    print("\nDownloading CLIP models...")
    download_file(
        "comfyanonymous/flux_text_encoders",
        "clip_l.safetensors",
        r"__CLIP_DIR__"
    )
    
    # T5 XXL FP8 for lower VRAM
    print("\nDownloading T5 XXL FP8 encoder...")
    download_file(
        "comfyanonymous/flux_text_encoders",
        "t5xxl_fp8.safetensors",
        r"__CLIP_DIR__"
    )
    
    # FLUX VAE
    print("\nDownloading FLUX VAE...")
    vae_path = download_file(
        "black-forest-labs/FLUX.1-schnell",
        "ae.safetensors",
        r"__VAE_DIR__"
    )
    import shutil
    final_path = os.path.join(os.path.dirname(vae_path), "flux.safetensors")
    if vae_path != final_path and not os.path.exists(final_path):
        shutil.move(vae_path, final_path)
        print(f"Renamed to: {final_path}")

if selection in ["2", "3"]:
    print("\n=== Downloading Z-Image-Turbo ===")
    
    # Z-Image-Turbo - low VRAM alternative
    try:
        download_file(
            "Tongyi-MAI/Z-Image-Turbo",
            "z_image_turbo.safetensors",
            r"__CHECKPOINTS_DIR__"
        )
    except Exception as e:
        print(f"Error downloading Z-Image-Turbo: {e}")
        print("Trying alternative filename...")
        try:
            # Try snapshot download for the whole repo
            download_repo(
                "Tongyi-MAI/Z-Image-Turbo",
                r"__CHECKPOINTS_DIR__\z-image-turbo"
            )
        except Exception as e2:
            print(f"Could not download Z-Image-Turbo: {e2}")

print("\n=== Download Complete ===")
'@

# Replace placeholders
$downloadScriptContent = $downloadScriptContent -replace "__SELECTION__", $selection
$downloadScriptContent = $downloadScriptContent -replace "__CHECKPOINTS_DIR__", $checkpointsDir
$downloadScriptContent = $downloadScriptContent -replace "__CLIP_DIR__", $clipDir
$downloadScriptContent = $downloadScriptContent -replace "__VAE_DIR__", $vaeDir

# Save and run download script
$downloadScriptPath = "$comfyDir\download_models.py"
$downloadScriptContent | Out-File -FilePath $downloadScriptPath -Encoding UTF8

if ($selection -ne "4") {
    Write-Host ""
    Write-Host "Downloading models (this may take 10-30 minutes)..." -ForegroundColor Yellow
    python $downloadScriptPath
}

if ($LASTEXITCODE -eq 0 -or $selection -eq "4") {
    Write-Host ""
    Write-Host "=== Setup Complete! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Models directory: $checkpointsDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start ComfyUI:" -ForegroundColor Cyan
    Write-Host "  cd $comfyDir" -ForegroundColor White
    Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  python main.py --listen 0.0.0.0 --port 8188 --lowvram" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: Using --lowvram flag for 8GB VRAM optimization" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "LoFi AI Studio will auto-connect to ComfyUI on startup!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "=== Download may have had issues ===" -ForegroundColor Yellow
    Write-Host "Check the error messages above. You may need to download models manually." -ForegroundColor White
    Write-Host ""
    Write-Host "Manual download links:" -ForegroundColor Cyan
    Write-Host "  FLUX.2: https://huggingface.co/collections/black-forest-labs/flux2" -ForegroundColor White
    Write-Host "  Z-Image-Turbo: https://huggingface.co/Tongyi-MAI/Z-Image-Turbo" -ForegroundColor White
}