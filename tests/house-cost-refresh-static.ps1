$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Get-Content -Raw -Encoding UTF8 (Join-Path $root "backend/Finance_codegs.txt")
$frontend = Get-Content -Raw -Encoding UTF8 (Join-Path $root "features/reports-house-costs.js")
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

Assert-Contains $backend 'HOUSE_COST_CATEGORY_NAGYTETENY_\s*=\s*"K01[^"]+"' `
    "A riport pontosan a K01 nagytétényi kategóriát használja."
Assert-Contains $backend 'ensureSheetColumns_\(houseSheet,\s*HOUSE_COST_SYNC_COLUMNS_\)' `
    "A House_Costs stabil megosztottköltség-forrásazonosítót kap."
Assert-Contains $backend '"paid_by",\s*"Zsolti_balance",\s*"Dori_balance"' `
    "A House_Costs tárolja a fizetőt és a személyenkénti egyenlegeket."
Assert-Contains $backend 'rowTransactionId\s*===\s*txId\s*&&\s*!rowSharedExpenseId' `
    "A közvetlen tranzakciószinkron nem ír felül megosztott forrású sort."
Assert-Contains $backend 'directTransactionIds\.has\(transactionId\)' `
    "A megosztott rekord duplikációja tranzakcióazonosító alapján kizárható."
Assert-Contains $backend 'directTransactions\.forEach\(tx\s*=>' `
    "A közvetlen tranzakciók szinkronja megelőzi a megosztott költségeket."
Assert-Contains $backend 'sharedExpenses\.forEach\(sharedExpense\s*=>' `
    "A megosztott költségek külön szinkronlépésben kerülnek feldolgozásra."
Assert-Contains $backend 'function refreshHouseCosts_\(' `
    "Létezik teljes házköltség-frissítés."
Assert-Contains $backend 'replaceSheetDataRows_\(houseSheet,\s*houseHeader,\s*outputRows\)' `
    "A Házköltségek frissítése tömbösített munkalapírást használ."
Assert-Contains $html 'id="refreshHouseCostsBtn"' `
    "A Házköltségek oldalon van Frissítés gomb."
Assert-Contains $html 'id="globalActivityLogPanel"' `
    "Minden oldalon elérhető globális változásnapló van."
Assert-Contains $html 'id="globalActivityLogCopy"' `
    "A globális változásnapló másolható."
Assert-Contains $html 'id="globalActivityLogClear"' `
    "A globális változásnapló törölhető."
Assert-Contains $html 'id="houseCostsSettlementBalance"' `
    "A riport egyetlen, szöveges elszámolási egyenleget jelenít meg."
Assert-Contains $html 'id="houseCostsDoriPaid"' `
    "A riport megjeleníti a Dóri által fizetett nem rendezett összeget."
Assert-Contains $html 'id="houseCostsZsoltiPaid"' `
    "A riport megjeleníti a Zsolti által fizetett nem rendezett összeget."
Assert-Contains $frontend 'row\?\.paid_by' `
    "A riport soronként megjeleníti, hogy ki fizetett."
Assert-Contains $frontend '\(result\.doriPaid\s*-\s*result\.zsoltiPaid\)\s*/\s*2' `
    "Az elszámolási egyenleg a fizetett összegek különbségének fele."
Assert-Contains $frontend 'Zsolti tartozik D.rinak' `
    "A riport egyértelműen kiírja, ha Zsolti tartozik Dórinak."
Assert-Contains $frontend 'D.ri tartozik Zsoltinak' `
    "A riport egyértelműen kiírja, ha Dóri tartozik Zsoltinak."
Assert-Contains $frontend 'filter\(row\s*=>\s*!isHouseCostSettled\(row\)\)' `
    "A rendezett tételek kimaradnak a nettó egyenlegből."
Assert-Contains $frontend 'house-cost-settled-checkbox' `
    "A riport soraihoz Rendezve checkbox tartozik."
Assert-Contains $backend 'function updateHouseCostSettled_\(' `
    "A backend tartósan menti a rendezettségi flaget."
Assert-Contains $api 'updateHouseCostSettled\(id,\s*settled\)' `
    "A frontend API tartalmazza a rendezettség módosítását."
Assert-Contains $frontend 'api\.refreshHouseCosts\(\)' `
    "A riport Frissítés gombja meghívja a szinkron API-t."
Assert-Contains $backend 'logRefresh\("[^"\r\n]+:\s*"\s*\+\s*sourceLabel' `
    "A backend rekordszintű frissítési eseményeket naplóz."
Assert-Contains $frontend 'sharedExpenseId\s*\?\s*`[^`]*\$\{sharedExpenseId\}' `
    "A riport láthatóan jelöli a megosztott költség forrását."
Assert-Contains $api 'refreshHouseCosts\(\)' `
    "A frontend API tartalmazza a házköltség-frissítést."

Write-Output "ALL HOUSE COST REFRESH TESTS PASSED"
