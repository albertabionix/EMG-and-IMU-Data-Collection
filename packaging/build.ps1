# Build the Windows app and its release zip:
#   dist\<APP_NAME>\<APP_NAME>.exe
#   dist\<App-Name>-windows.zip
# APP_NAME comes from packaging\EMG-IMU.spec, the only place it's defined.
# Run from anywhere with the project venv active. See README "Building it yourself".
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$match = Select-String -Path packaging\EMG-IMU.spec -Pattern '^APP_NAME = "(.*)"$'
if (-not $match) { throw "Could not read APP_NAME from packaging\EMG-IMU.spec" }
$AppName = $match.Matches[0].Groups[1].Value
$Zip = "dist\$($AppName -replace ' ', '-')-windows.zip"

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

Write-Host "==> Zipping"
if (Test-Path $Zip) { Remove-Item $Zip }
Compress-Archive -Path "dist\$AppName" -DestinationPath $Zip

Write-Host ""
Write-Host "Done: $Root\dist\$AppName\$AppName.exe"
Write-Host "      $Root\$Zip"
