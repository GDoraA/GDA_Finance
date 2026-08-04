$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$api = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "scripts\api.js")
$styles = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "styles.css")
$serviceWorker = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "service-worker.js")

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "FAIL: $Message"
    }

    Write-Output "PASS: $Message"
}

Assert-True (
    $api.Contains('let activeApiRequestCount = 0;') -and
    $api.Contains('function setApiLoadingState(isLoading)') -and
    $api.Contains('activeApiRequestCount > 0')
) "A globális töltési állapot párhuzamos API-kéréseket is számlál."

Assert-True (
    $api.Contains('setApiLoadingState(true);') -and
    $api.Contains('setApiLoadingState(false);') -and
    $api.Contains('loadingStateReleased')
) "Az API-kérés induláskor bekapcsolja, lezáráskor pontosan egyszer kikapcsolja a töltési állapotot."

Assert-True (
    $styles.Contains('html.api-loading') -and
    $styles.Contains('cursor: wait !important;')
) "Töltés közben az egész alkalmazás várakozó kurzort jelenít meg."

Assert-True (
    $serviceWorker.Contains('gda-finance-cache-v40')
) "A service worker új cache-verzióval tölti le a módosított API- és CSS-fájlt."

Write-Output "ALL API LOADING CURSOR TESTS PASSED"
