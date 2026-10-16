# PocketCircle One-Command Development Launcher
Write-Host "Launching PocketCircle (FastAPI Backend + React Frontend)..." -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing workspace dependencies..." -ForegroundColor Yellow
    npm install
}

npm run dev
