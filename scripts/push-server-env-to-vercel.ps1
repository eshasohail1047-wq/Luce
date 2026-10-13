$ErrorActionPreference = 'Stop'

function Get-EnvLocalValue([string]$Name) {
  $line = Get-Content .env.local | Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } | Select-Object -First 1
  if (-not $line) { return $null }
  $value = ($line -split '=', 2)[1]
  if ($null -eq $value) { return $null }
  $value = $value.Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  return $value
}

$pairs = @(
  @{ Name = 'RESEND_API_KEY'; Value = (Get-EnvLocalValue 'RESEND_API_KEY') },
  @{ Name = 'RESEND_FROM'; Value = (Get-EnvLocalValue 'RESEND_FROM') },
  @{ Name = 'FIREBASE_SERVICE_ACCOUNT_JSON'; Value = (Get-EnvLocalValue 'FIREBASE_SERVICE_ACCOUNT_JSON') },
  @{ Name = 'PASSWORD_RESET_CONTINUE_URL'; Value = 'https://luce-landing.vercel.app/login' }
)

foreach ($pair in $pairs) {
  if (-not $pair.Value) {
    Write-Error "Missing $($pair.Name) in .env.local"
    exit 1
  }
}

$pushed = @()
foreach ($pair in $pairs) {
  foreach ($target in @('production', 'preview')) {
    $tmp = New-TemporaryFile
    try {
      # UTF8 no BOM, no trailing newline issues handled by vercel
      [System.IO.File]::WriteAllText($tmp.FullName, $pair.Value)
      Get-Content -Raw $tmp.FullName | npx vercel env add $pair.Name $target --scope esha-s1 --type secret --force --yes
      if ($LASTEXITCODE -ne 0) {
        Write-Error "FAIL $($pair.Name) $target"
        exit 1
      }
    } finally {
      Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
    }
  }
  $pushed += $pair.Name
}

Write-Host ("Pushed secrets: " + ($pushed -join ', '))
