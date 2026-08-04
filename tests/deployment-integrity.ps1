$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$textExtensions = @(".js", ".html", ".css", ".json", ".txt", ".md", ".ps1", ".mjs")
$conflicts = Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object {
    $textExtensions -contains $_.Extension.ToLowerInvariant() -and
    $_.FullName -notmatch '[\\/]\.git[\\/]'
} | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)' -Encoding UTF8

if ($conflicts) {
    $details = ($conflicts | ForEach-Object { "$($_.Path):$($_.LineNumber) $($_.Line)" }) -join "`n"
    throw "Git konfliktusjelölés található a publikálandó fájlokban:`n$details"
}

$serviceWorkerPath = Join-Path $root "service-worker.js"
$serviceWorker = Get-Content -Raw -Encoding UTF8 $serviceWorkerPath
$assetsBlock = [regex]::Match($serviceWorker, 'const\s+ASSETS\s*=\s*\[(?<items>[\s\S]*?)\];')
if (-not $assetsBlock.Success) {
    throw "A service-worker.js ASSETS listája nem olvasható."
}

$assetPaths = [regex]::Matches($assetsBlock.Groups["items"].Value, '"\./(?<path>[^"]+)"') |
    ForEach-Object { $_.Groups["path"].Value }
foreach ($assetPath in $assetPaths) {
    $localPath = Join-Path $root ($assetPath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $localPath)) {
        throw "A service worker nem létező fájlt próbál cache-elni: $assetPath"
    }
}

$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $root "manifest.json") | ConvertFrom-Json
foreach ($icon in $manifest.icons) {
    $iconPath = ([string]$icon.src).TrimStart(".", "/") -replace '/', [IO.Path]::DirectorySeparatorChar
    if (-not (Test-Path -LiteralPath (Join-Path $root $iconPath))) {
        throw "A manifest nem létező ikonra hivatkozik: $($icon.src)"
    }
}

Write-Output "ALL DEPLOYMENT INTEGRITY TESTS PASSED"
