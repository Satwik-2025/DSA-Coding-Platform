# One command for local development on Windows (PowerShell):
#   .\start.ps1
# Builds and starts the backend (http://localhost:8081), waits until it answers, then starts the
# frontend (http://localhost:5173). Ctrl+C stops both. Needs Java 17+, Maven and Node 22+.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

foreach ($tool in 'java', 'mvn', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing '$tool'. Install it and try again." }
}

if (-not (Test-Path 'frontend/.env')) { Copy-Item 'frontend/.env.example' 'frontend/.env' }
if (-not (Test-Path 'frontend/node_modules')) { Push-Location frontend; npm install; Pop-Location }

Write-Host 'Building the backend...'
Push-Location backend
mvn -B -q -DskipTests package
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Backend build failed.' }
$jar = (Get-ChildItem 'target/dsa-platform-*.jar' | Select-Object -First 1).FullName
# Started from backend/ so the default H2 database lives in backend/data.
$backend = Start-Process java -ArgumentList '-jar', "`"$jar`"" -WorkingDirectory (Get-Location) -NoNewWindow -PassThru
Pop-Location

try {
    Write-Host 'Waiting for the backend on http://localhost:8081 ...'
    while ($true) {
        if ($backend.HasExited) { throw 'The backend stopped during startup.' }
        try { Invoke-RestMethod 'http://localhost:8081/api/users' -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 2 }
    }
    Write-Host 'Backend is up. Starting the frontend: open http://localhost:5173'
    Push-Location frontend
    npm run dev
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
