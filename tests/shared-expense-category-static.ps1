$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Get-Content -Raw -Encoding UTF8 (Join-Path $root "backend/Finance_codegs.txt")
$frontend = Get-Content -Raw -Encoding UTF8 (Join-Path $root "features/sharedExp.js")
$api = Get-Content -Raw -Encoding UTF8 (Join-Path $root "scripts/api.js")
$html = Get-Content -Raw -Encoding UTF8 (Join-Path $root "index.html")

function Assert-Contains {
    param(
        [string]$Text,
        [string]$Pattern,
        [string]$Message
    )

    if ($Text -notmatch $Pattern) {
        throw "FAIL: $Message"
    }

    Write-Output "PASS: $Message"
}

Assert-Contains $backend 'ensureSheetColumns_\(sheet,\s*\["category"\]\)' `
    "A Shared_Expenses category oszlopa idempotensen létrejön."
Assert-Contains $backend 'newRow\[colCategory\]\s*=\s*tx\.category' `
    "Az új tranzakciós megosztott rekord megkapja a kategóriát."
Assert-Contains $backend 'row\[colCategory\]\s*=\s*tx\.category' `
    "A meglévő tranzakciós megosztott rekord kategóriája frissül."
Assert-Contains $backend 'function refreshSharedExpensesFromTransactions_\(' `
    "Létezik teljes tranzakciós megosztottköltség-frissítés."
Assert-Contains $html 'id="seCategory"[^>]+list="categoriesList"' `
    "A megosztott költség kategóriája a tranzakciós értékkészletet használja."
Assert-Contains $html 'id="refreshSharedExpensesBtn"' `
    "A Megosztott költségek oldalon van Frissítés gomb."
Assert-Contains $frontend 'api\.refreshSharedExpenses\(\)' `
    "A Frissítés gomb meghívja a szinkron API-t."
Assert-Contains $api 'refreshSharedExpenses\(\)' `
    "A frontend API tartalmazza a megosztottköltség-frissítést."

Write-Output "ALL SHARED EXPENSE CATEGORY TESTS PASSED"
