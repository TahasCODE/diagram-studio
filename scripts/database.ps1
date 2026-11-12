param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $studioRoot '.runtime'
$dataPath = Join-Path $runtimePath 'postgres'
$pgBin = (Get-Command initdb.exe -ErrorAction SilentlyContinue).Source
if (!$pgBin) { throw 'Install PostgreSQL and add its bin directory to PATH, or use Docker Compose.' }
$pgBin = Split-Path $pgBin -Parent
New-Item -ItemType Directory -Force $runtimePath | Out-Null
if ($Action -eq 'stop') {
  if (Test-Path (Join-Path $dataPath 'postmaster.pid')) { & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -m fast stop }
  exit $LASTEXITCODE
}
$localPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { 'diagram_local_only' }
if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  $passwordPath = Join-Path $runtimePath 'database-password.txt'
  [System.IO.File]::WriteAllText($passwordPath, $localPassword, (New-Object System.Text.UTF8Encoding $false))
  & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U diagram --auth=scram-sha-256 --pwfile=$passwordPath --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the isolated Diagram Studio database.' }
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath (Join-Path $pgBin 'postgres.exe') -ArgumentList @('-D',('"{0}"' -f $dataPath),'-p','55432','-h','127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'postgres.log') -RedirectStandardError (Join-Path $runtimePath 'postgres-error.log') | Out-Null
}
$env:PGPASSWORD = $localPassword
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 -U diagram -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 200
  }
  if (!$ready) { throw 'Database did not start. Check .runtime/postgres-error.log.' }
  foreach ($databaseName in @('diagram_studio','diagram_studio_test')) {
    $exists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p 55432 -U diagram -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
    if ($LASTEXITCODE -ne 0) { throw 'Could not connect to the isolated database.' }
    if ($exists -ne '1') { & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U diagram $databaseName }
    if ($LASTEXITCODE -ne 0) { throw "Could not create $databaseName." }
  }
  Write-Host 'Diagram Studio PostgreSQL is ready at 127.0.0.1:55432 (isolated from existing databases).'
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
