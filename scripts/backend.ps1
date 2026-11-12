param([ValidateSet('run','test','package','wrapper','verify')][string]$Task = 'run')
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$javaCandidates = @($env:JAVA_HOME) + @(Get-ChildItem (Join-Path $env:USERPROFILE '.jdks') -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName) + @(Get-ChildItem 'C:/Program Files/Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$jdkPath = $javaCandidates | Where-Object {
  if (!$_) { return $false }
  $javac = Join-Path $_ 'bin/javac.exe'
  if (!(Test-Path $javac)) { return $false }
  $versionOutput = & $javac -version 2>&1 | Out-String
  return $versionOutput -match '\b25(?:\.|\s)'
} | Select-Object -First 1
if (!$jdkPath) { throw 'Install JDK 25 and set JAVA_HOME before starting the API.' }
$env:JAVA_HOME = $jdkPath
$mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($mavenCommand) { $mavenPath = $mavenCommand.Source }
else { $mavenPath = Get-ChildItem (Join-Path $env:USERPROFILE '.m2/wrapper/dists') -Filter mvn.cmd -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
Push-Location (Join-Path $studioRoot 'backend')
try {
  if (!$mavenPath -and (Test-Path './mvnw.cmd')) { $mavenPath = (Resolve-Path './mvnw.cmd').Path }
  if (!$mavenPath) { throw 'Maven is unavailable. Install Maven 3.9+ or use Docker Compose.' }
  switch ($Task) {
    'run' { & $mavenPath '-B' '--no-transfer-progress' 'spring-boot:run' }
    'test' { & $mavenPath '-B' '--no-transfer-progress' 'test' }
    'verify' { & $mavenPath '-B' '--no-transfer-progress' 'verify' '-Pintegration' }
    'package' { & $mavenPath '-B' '--no-transfer-progress' 'clean' 'package' }
    'wrapper' { & $mavenPath '-B' '--no-transfer-progress' 'wrapper:wrapper' '-Dmaven=3.9.16' '-Dtype=only-script' }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
