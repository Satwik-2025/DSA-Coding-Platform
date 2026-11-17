# Starts the whole site on Windows. Easiest: double-click start.cmd (it runs this file).
# From PowerShell in this folder you can also run:  powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Builds and starts the backend (http://localhost:8081), waits until it answers, then starts the
# frontend (http://localhost:5173) and opens it in the browser. Ctrl+C stops both.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Fail($message) {
    Write-Host ''
    Write-Host "PROBLEM: $message" -ForegroundColor Red
    exit 1
}

function Major($text) {
    if ($text -match '(\d+)(\.\d+)?') { return [int]$Matches[1] } else { return 0 }
}

# ---------------------------------------------------------------- tools
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Fail 'Java is not installed. Install a JDK 17 or newer (e.g. https://adoptium.net) and open a new terminal.'
}
if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
    Fail "Java is installed but it is not a full JDK ('javac' is missing). Install a JDK 17+ from https://adoptium.net."
}
$javaVersion = Major (((& cmd /c 'java -version 2>&1') | Select-Object -First 1) -replace '^[^"]*"', '')
if ($javaVersion -lt 17) { Fail "Java $javaVersion found, but Java 17 or newer is needed (https://adoptium.net)." }
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
    Fail 'Maven is not installed. Download it from https://maven.apache.org/download.cgi, add its bin folder to PATH, and open a new terminal.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js is not installed. Install Node 20 or newer from https://nodejs.org and open a new terminal.'
}
$nodeVersion = Major (& node -v)
if ($nodeVersion -lt 20) { Fail "Node $nodeVersion found, but Node 20 or newer is needed (https://nodejs.org)." }
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command python3 -ErrorAction SilentlyContinue)) {
    Write-Host 'Note: Python is not installed, so Python solutions will not be offered (Java still works).' -ForegroundColor Yellow
}

# ---------------------------------------------------------------- ports
function PortOwner($port) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue }
    return $null
}

function BackendAnswers {
    try { Invoke-RestMethod 'http://localhost:8081/api/users' -TimeoutSec 2 | Out-Null; return $true } catch { return $false }
}

$reuseBackend = $false
$owner = PortOwner 8081
if ($owner) {
    if (BackendAnswers) {
        Write-Host 'The backend is already running on port 8081; using it.' -ForegroundColor Yellow
        $reuseBackend = $true
    } else {
        Fail "Port 8081 is used by another program ($($owner.ProcessName), id $($owner.Id)). Close it, or stop it with:  Stop-Process -Id $($owner.Id)"
    }
}
$owner = PortOwner 5173
if ($owner) {
    Fail "Port 5173 is already in use ($($owner.ProcessName), id $($owner.Id)) - probably the site is already open in another window. Close that window, or run:  Stop-Process -Id $($owner.Id)"
}

# ---------------------------------------------------------------- frontend packages
if (-not (Test-Path 'frontend/.env')) { Copy-Item 'frontend/.env.example' 'frontend/.env' }
if (-not (Test-Path 'frontend/node_modules')) {
    Write-Host 'Installing frontend packages (first run only, takes a minute)...'
    Push-Location frontend
    npm install
    $ok = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $ok) { Fail 'npm install failed. Check your internet connection and run start.cmd again.' }
}

# ---------------------------------------------------------------- backend
$backend = $null
if (-not $reuseBackend) {
    Write-Host 'Building the backend (the first build downloads libraries and takes a few minutes)...'
    Push-Location backend
    mvn -B -q -DskipTests package
    $ok = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $ok) { Fail 'The backend build failed. The Maven output above says why.' }
    $jar = (Get-ChildItem 'backend/target/dsa-platform-*.jar' | Select-Object -First 1).FullName
    # Started from backend/ so the default database lives in backend/data.
    $backend = Start-Process java -ArgumentList '-jar', "`"$jar`"" -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -NoNewWindow -PassThru
}

try {
    if ($backend) {
        Write-Host 'Starting the backend on http://localhost:8081 ...'
        $waited = 0
        while (-not (BackendAnswers)) {
            if ($backend.HasExited) { Fail 'The backend stopped while starting. Its messages are just above.' }
            if ($waited -ge 180) { Fail 'The backend did not answer within 3 minutes.' }
            Start-Sleep -Seconds 2
            $waited += 2
        }
    }

    # Open the browser as soon as the frontend answers (in the background, so it does not block npm).
    Start-Job {
        for ($i = 0; $i -lt 60; $i++) {
            try { Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process 'http://localhost:5173'; break }
            catch { Start-Sleep -Seconds 1 }
        }
    } | Out-Null

    Write-Host ''
    Write-Host 'Site starting at http://localhost:5173  (keep this window open; press Ctrl+C to stop)' -ForegroundColor Green
    Push-Location frontend
    npm run dev
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
