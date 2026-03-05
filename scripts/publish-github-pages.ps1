param(
  [Parameter(Mandatory = $true)]
  [string]$Org,

  [Parameter(Mandatory = $true)]
  [string]$Repo,

  [string]$Branch = "main",
  [string]$RemoteName = "origin",
  [string]$CommitMessage = "chore: publish site updates",
  [switch]$SkipCommit
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
  throw "Run this script from the repository root (folder containing .git)."
}

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE."
  }
}

$repoUrl = "https://github.com/$Org/$Repo.git"

$existingRemote = ""
try {
  $existingRemote = (& git remote get-url $RemoteName).Trim()
} catch {
  $existingRemote = ""
}

if (-not $existingRemote) {
  Write-Host "Adding remote '$RemoteName' -> $repoUrl"
  Invoke-Git -Args @("remote", "add", $RemoteName, $repoUrl)
} elseif ($existingRemote -ne $repoUrl) {
  Write-Host "Remote '$RemoteName' already points to: $existingRemote"
  Write-Host "If you want to replace it, run:"
  Write-Host "git remote set-url $RemoteName $repoUrl"
}

Invoke-Git -Args @("add", "-A")

$stagedFiles = & git diff --cached --name-only
if (-not [string]::IsNullOrWhiteSpace(($stagedFiles -join ""))) {
  if ($SkipCommit) {
    Write-Host "Skipping commit because -SkipCommit was provided."
  } else {
    Write-Host "Creating commit..."
    Invoke-Git -Args @("commit", "-m", $CommitMessage)
  }
} else {
  Write-Host "No staged changes to commit."
}

Invoke-Git -Args @("branch", "-M", $Branch)

Write-Host "Pushing to $RemoteName/$Branch ..."
Invoke-Git -Args @("push", "-u", $RemoteName, $Branch)

Write-Host ""
Write-Host "Push complete."
Write-Host "Next: GitHub -> Settings -> Pages -> Source: GitHub Actions (one-time setup)."
