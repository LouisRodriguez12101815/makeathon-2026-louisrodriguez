$ErrorActionPreference = 'Stop'

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $line = Get-Content -Path $Path | Where-Object { $_ -match ('^' + [regex]::Escape($Key) + '=') } | Select-Object -First 1
  if (-not $line) {
    throw "Missing $Key in $Path"
  }

  $val = $line.Split('=', 2)[1].Trim()

  # Strip wrapping quotes: FIGMA_FILE_KEY and NEXT_PUBLIC_SUPABASE_URL are often quoted.
  if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[$val.Length - 1] -eq '"') -or ($val[0] -eq "'" -and $val[$val.Length - 1] -eq "'"))) {
    $val = $val.Substring(1, $val.Length - 2)
  }

  return $val
}

$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (-not (Test-Path $envFile)) {
  throw "Missing .env.local at $envFile"
}

$FIGMA_ACCESS_TOKEN = Get-EnvValue -Key 'FIGMA_ACCESS_TOKEN' -Path $envFile
$FIGMA_FILE_KEY = Get-EnvValue -Key 'FIGMA_FILE_KEY' -Path $envFile
$SUPABASE_URL = Get-EnvValue -Key 'NEXT_PUBLIC_SUPABASE_URL' -Path $envFile
$SUPABASE_ANON = Get-EnvValue -Key 'NEXT_PUBLIC_SUPABASE_ANON_KEY' -Path $envFile

# Set both production + preview so the app works for prod deploys and preview links.
$targets = @('production', 'preview')

foreach ($target in $targets) {
  vercel env add FIGMA_ACCESS_TOKEN $target --value $FIGMA_ACCESS_TOKEN --yes --force --sensitive | Out-Null
  vercel env add FIGMA_FILE_KEY $target --value $FIGMA_FILE_KEY --yes --force --sensitive | Out-Null
  vercel env add NEXT_PUBLIC_SUPABASE_URL $target --value $SUPABASE_URL --yes --force --sensitive | Out-Null
  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY $target --value $SUPABASE_ANON --yes --force --sensitive | Out-Null
}

Write-Host "Vercel env vars set for: $($targets -join ', ')" -ForegroundColor Green
