$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$senderAddress = (Read-Host 'Gmail sender address').Trim()
try {
  $parsedAddress = [System.Net.Mail.MailAddress]::new($senderAddress)
  if ($parsedAddress.Address -ne $senderAddress) { throw 'Enter only the email address.' }
} catch { throw 'Enter a valid Gmail or Google Workspace sender address.' }
$appPassword = Read-Host 'Gmail App Password (not your regular password)' -AsSecureString
if ($appPassword.Length -eq 0) { throw 'An App Password is required.' }
$mailVariables = @('MAIL_HOST','MAIL_PORT','MAIL_USERNAME','MAIL_FROM','MAIL_PASSWORD','MAIL_AUTH','MAIL_STARTTLS')
$previousMail = @{}
foreach ($variable in $mailVariables) { $previousMail[$variable] = [Environment]::GetEnvironmentVariable($variable,'Process') }
try {
  $env:MAIL_HOST = 'smtp.gmail.com'
  $env:MAIL_PORT = '587'
  $env:MAIL_USERNAME = $senderAddress
  $env:MAIL_FROM = $senderAddress
  $env:MAIL_PASSWORD = ([System.Net.NetworkCredential]::new('', $appPassword).Password).Replace(' ','')
  $env:MAIL_AUTH = 'true'
  $env:MAIL_STARTTLS = 'true'
  Write-Host 'Starting Diagram Studio with Gmail SMTP. Credentials are not written to a file.'
  & (Join-Path $studioRoot 'scripts/start.ps1')
} finally {
  foreach ($variable in $mailVariables) { [Environment]::SetEnvironmentVariable($variable,$previousMail[$variable],'Process') }
  $previousMail.Clear()
  $appPassword.Dispose()
}
