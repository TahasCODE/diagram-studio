$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
Set-Location $studioRoot
if (!(Test-Path 'node_modules')) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& (Join-Path $PSScriptRoot 'database.ps1') start
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $PSScriptRoot 'backend.ps1') package
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# Recheck the database after the build before handing control to Spring Boot.
& (Join-Path $PSScriptRoot 'database.ps1') start
Write-Host 'Opening the application server at http://localhost:8090. Press Ctrl+C to stop it.'
& (Join-Path $env:JAVA_HOME 'bin/java.exe') -jar (Join-Path $studioRoot 'backend/target/diagram-studio-1.0.0.jar') --logging.level.root=INFO --logging.level.org.springframework=INFO
exit $LASTEXITCODE
