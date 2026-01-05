# ============================================================================
#  Sentraexam - Automated Setup Script (Windows PowerShell)
# ============================================================================
#  Usage: Right-click and "Run with PowerShell" OR execute: .\setup.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Blue
Write-Host "   Sentraexam - Automated Setup Script" -ForegroundColor Blue
Write-Host "==============================================" -ForegroundColor Blue
Write-Host ""

# Check Python
Write-Host "[1/8] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.11+ first." -ForegroundColor Red
    exit 1
}

# Check Node.js
Write-Host "[2/8] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Create virtual environment
Write-Host "[3/8] Creating Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "✓ Virtual environment already exists" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "[4/8] Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1
Write-Host "✓ Virtual environment activated" -ForegroundColor Green

# Install Python dependencies
Write-Host "[5/8] Installing Python dependencies..." -ForegroundColor Yellow
pip install --upgrade pip | Out-Null
pip install -r requirements/base.txt
Write-Host "✓ Python dependencies installed" -ForegroundColor Green

# Setup environment file
Write-Host "[6/8] Setting up environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    @"
DEBUG=True
SECRET_KEY=dev-secret-key-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

VITE_API_BASE_URL=http://localhost:8000/api

DB_NAME=sentraexam
DB_USER=sentraexam
DB_PASSWORD=sentraexam
DB_HOST=localhost
DB_PORT=5432

REDIS_URL=redis://localhost:6379/0

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=no-reply@sentraexam.local
DJANGO_SETTINGS_MODULE=config.settings.local

# Add your Gemini API key for AI gaze analysis (optional)
# GEMINI_API_KEY=your-key-here
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ Environment file created" -ForegroundColor Green
} else {
    Write-Host "✓ Environment file already exists" -ForegroundColor Green
}

# Run database migrations
Write-Host "[7/8] Running database migrations..." -ForegroundColor Yellow
python manage.py migrate
Write-Host "✓ Database migrations complete" -ForegroundColor Green

# Create test accounts
Write-Host "[8/8] Creating test accounts..." -ForegroundColor Yellow
try { python manage.py create_test_accounts } catch {}
try { python manage.py create_test_assessments } catch {}
Write-Host "✓ Test data created" -ForegroundColor Green

# Setup frontend
Write-Host ""
Write-Host "Setting up Frontend..." -ForegroundColor Blue
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
if (-not (Test-Path ".env")) {
    "VITE_API_BASE_URL=http://localhost:8000/api" | Out-File -FilePath ".env" -Encoding UTF8
}
Pop-Location
Write-Host "✓ Frontend setup complete" -ForegroundColor Green

# Done!
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "   Setup Complete! 🎉" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Blue
Write-Host ""
Write-Host "  Backend (Terminal 1):"
Write-Host "    .\venv\Scripts\Activate.ps1"
Write-Host "    python manage.py runserver"
Write-Host ""
Write-Host "  Frontend (Terminal 2):"
Write-Host "    cd frontend"
Write-Host "    npm run dev"
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Blue
Write-Host "  Frontend: http://localhost:5173"
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  API Docs: http://localhost:8000/api/docs/"
Write-Host ""
Write-Host "Test Accounts (Password: Test@123):" -ForegroundColor Blue
Write-Host "  Admin:   admin@sentraexam.com"
Write-Host "  HOD:     hod@sentraexam.com"
Write-Host "  Teacher: teacher@sentraexam.com"
Write-Host "  Student: student@sentraexam.com"
Write-Host ""
