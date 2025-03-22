# PowerShell script to start the development server for XRPChat
Write-Host "Starting XRPChat development server..." -ForegroundColor Green

# Change to the project directory if needed
$projectDir = "$PSScriptRoot"
Set-Location -Path $projectDir

# Start the development server
Write-Host "Running npm run dev..." -ForegroundColor Cyan
npm run dev

# If the command fails, show an error message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start the development server. Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Please check that all dependencies are installed by running 'npm install' first." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

# This part will only execute if the development server is manually stopped
Write-Host "Development server stopped." -ForegroundColor Green 