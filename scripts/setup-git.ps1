
# Setup Git Repository
Write-Host "Initializing Git..."

if (-not (Test-Path ".git")) {
    git init
    Write-Host "Git initialized."
}

if (-not (Test-Path ".gitignore")) {
    Set-Content .gitignore "node_modules/`n.next/`n.env*.local`n.DS_Store`n"
}

git add .
git commit -m "feat: Initial setup - Next.js + Supabase"

Write-Host "Repo ready!"
