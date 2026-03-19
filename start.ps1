# PowerShell launcher for FactoryGuard FastAPI

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# Activate virtual env if present
$venv = Join-Path $ScriptDir ".venv\\Scripts\\Activate.ps1"
if (Test-Path $venv) {
    . $venv
}

# Ensure project root on PYTHONPATH
$env:PYTHONPATH = "$ScriptDir;$env:PYTHONPATH"

# Start FastAPI
uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload

