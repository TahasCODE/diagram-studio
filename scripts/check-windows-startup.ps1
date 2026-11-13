# CI-only lifecycle regression: never stop a developer's active database.
$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true') { throw 'Run this lifecycle check only in an isolated CI checkout.' }
$studioRoot = Split-Path $PSScriptRoot -Parent
$databaseScript = Join-Path $PSScriptRoot 'database.ps1'
$runtimePath = Join-Path $studioRoot '.runtime'
$pidPath = Join-Path $runtimePath 'postgres/postmaster.pid'
if (Test-Path (Join-Path $runtimePath 'postgres/PG_VERSION')) { throw 'This check requires a fresh CI cluster.' }
$previousPassword = $env:PGPASSWORD
try {
  & $databaseScript start
  $masterBefore = Get-Content $pidPath -TotalCount 1
  $env:PGPASSWORD = 'diagram_local_only'
  & psql.exe -X -w -h 127.0.0.1 -p 55432 -U diagram -d diagram_studio_test -c 'CREATE TABLE startup_regression_marker(id integer PRIMARY KEY); INSERT INTO startup_regression_marker VALUES (42);'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the test marker.' }
  $first = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f $databaseScript),'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'first-start.log') -RedirectStandardError (Join-Path $runtimePath 'first-start-error.log')
  $null = $first.Handle
  $second = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f $databaseScript),'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'second-start.log') -RedirectStandardError (Join-Path $runtimePath 'second-start-error.log')
  $null = $second.Handle
  $first.WaitForExit(); $second.WaitForExit()
  if ($first.ExitCode -ne 0 -or $second.ExitCode -ne 0) { throw 'Concurrent launchers failed.' }
  if ((Get-Content $pidPath -TotalCount 1) -ne $masterBefore) { throw 'Concurrent launches replaced the running server.' }
  & $databaseScript stop
  & $databaseScript start
  $marker = & psql.exe -X -w -h 127.0.0.1 -p 55432 -U diagram -d diagram_studio_test -tAc 'SELECT id FROM startup_regression_marker'
  if ($LASTEXITCODE -ne 0 -or $marker -ne '42') { throw 'Data was not preserved across restart.' }
  Write-Host 'Windows startup checks passed: cold start, concurrent reuse, clean shutdown, restart and data preservation.'
} finally {
  & $databaseScript stop
  [Environment]::SetEnvironmentVariable('PGPASSWORD',$previousPassword,'Process')
}
