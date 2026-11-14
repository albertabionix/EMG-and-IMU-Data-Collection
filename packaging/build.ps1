# Build the Windows app: dist\EMG-IMU Data Collection\EMG-IMU Data Collection.exe
# Run from anywhere with the project venv active. See README "Building the Executable".
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "==> Building frontend"
Push-Location code\frontend
npm ci;        if ($LASTEXITCODE) { throw "npm ci failed" }
npm run build; if ($LASTEXITCODE) { throw "npm run build failed" }
Pop-Location

Write-Host "==> Installing build tools"
python -m pip install -r requirements.txt -r packaging\requirements-build.txt
if ($LASTEXITCODE) { throw "pip install failed" }

Write-Host "==> Packaging with PyInstaller"
python -m PyInstaller packaging\EMG-IMU.spec --noconfirm --clean `
  --distpath dist --workpath build\pyinstaller
if ($LASTEXITCODE) { throw "PyInstaller failed" }

Write-Host ""
Write-Host "Done: $Root\dist\EMG-IMU Data Collection\EMG-IMU Data Collection.exe"
