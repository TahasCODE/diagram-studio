param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $studioRoot '.runtime'
$dataPath = Join-Path $runtimePath 'postgres'
$pgCommand = Get-Command initdb.exe -ErrorAction SilentlyContinue
if (!$pgCommand) { throw 'Install PostgreSQL and add its bin directory to PATH, or use Docker Compose.' }
$pgBin = Split-Path $pgCommand.Source -Parent
New-Item -ItemType Directory -Force $runtimePath | Out-Null
# Serialize launchers across terminals without modifying database files.
$databaseLock = $null
$lockDeadline = [DateTime]::UtcNow.AddSeconds(35)
while (!$databaseLock) {
  try { $databaseLock = [System.IO.File]::Open((Join-Path $runtimePath 'database-start.lock'),[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None) }
  catch [System.IO.IOException] {
    if ([DateTime]::UtcNow -ge $lockDeadline) { throw 'Another database operation is still running. Wait for it to finish before retrying.' }
    Start-Sleep -Milliseconds 200
  }
}
$previousPgPassword = $env:PGPASSWORD
try {
  if ($Action -eq 'stop') {
    if (Test-Path (Join-Path $dataPath 'postmaster.pid')) {
      & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -m fast -w -t 30 stop
      if ($LASTEXITCODE -ne 0) { throw 'Could not stop this project database cleanly.' }
    }
    return
  }
  $localPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { 'diagram_local_only' }
  if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
    $passwordPath = Join-Path $runtimePath 'database-password.txt'
    try {
      [System.IO.File]::WriteAllText($passwordPath,$localPassword,(New-Object System.Text.UTF8Encoding $false))
      & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U diagram --auth=scram-sha-256 --pwfile=$passwordPath --encoding=UTF8 --locale=C
      if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the isolated Diagram Studio database.' }
    } finally { if (Test-Path $passwordPath) { Remove-Item -LiteralPath $passwordPath } }
  }
  # TCP readiness works even when another Windows user launched the server.
  & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 -t 2 -q
  if ($LASTEXITCODE -ne 0) {
    # pg_ctl detaches correctly and appends logs rather than truncating an active log.
    & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -l (Join-Path $runtimePath 'postgres-server.log') -o '-p 55432 -h 127.0.0.1' -w -t 30 start
    if ($LASTEXITCODE -ne 0) { throw 'Database startup failed. Check .runtime/postgres-server.log. Do not delete database or PID files.' }
  }
  $env:PGPASSWORD = $localPassword
  $actualDirectory = & (Join-Path $pgBin 'psql.exe') -X -w -h 127.0.0.1 -p 55432 -U diagram -d postgres -tAc 'SHOW data_directory'
  if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to the local database. Check DB_PASSWORD and .runtime/postgres-server.log.' }
  $expectedDirectory = [System.IO.Path]::GetFullPath($dataPath).TrimEnd('\','/')
  if ([System.IO.Path]::GetFullPath(($actualDirectory | Out-String).Trim()).TrimEnd('\','/') -ne $expectedDirectory) {
    throw 'Port 55432 belongs to a different database cluster. No databases were created or changed.'
  }
  foreach ($databaseName in @('diagram_studio','diagram_studio_test')) {
    $exists = & (Join-Path $pgBin 'psql.exe') -X -w -h 127.0.0.1 -p 55432 -U diagram -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the isolated database.' }
    if ($exists -ne '1') {
      & (Join-Path $pgBin 'createdb.exe') -w -h 127.0.0.1 -p 55432 -U diagram $databaseName
      if ($LASTEXITCODE -ne 0) { throw "Could not create $databaseName." }
    }
  }
  Write-Host 'Diagram Studio PostgreSQL is ready at 127.0.0.1:55432.'
} finally {
  [Environment]::SetEnvironmentVariable('PGPASSWORD',$previousPgPassword,'Process')
  $databaseLock.Dispose()
}
