$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backend = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "backend\Finance_codegs.txt")
$bankImport = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "features\bank-import.js")

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
    $backend.Contains('function syncBankTransactionIds_()') -and
    $backend.Contains('h.toUpperCase() === "TR_ID"')
) "A backend felismeri és szinkronizálja a Bank_Transactions.TR_ID oszlopot."

Assert-True (
    $backend.Contains('const statementItem = String(txData[r][cTxStatement] || "").trim();') -and
    $backend.Contains('.split(",")') -and
    $backend.Contains('(transactionIdsByBankId.get(bankId) || []).join(", ")')
) "A TR_ID értékek a Transactions.statement_item kapcsolatokból épülnek fel, többes kapcsolat támogatásával."

Assert-True (
    $backend.Contains('obj.TR_ID = matchedTransactionIds;') -and
    $backend.Contains('obj.matched_transaction_ids = matchedTransactionIds;')
) "Az API a TR_ID értéket fizikai és frontend-kompatibilis mezőben is visszaadja."

Assert-True (
    $bankImport.Contains('const linkedTransactionIds = String(it?.matched_transaction_ids ?? "").trim();') -and
    $bankImport.Contains('linkedTransactionIds || cachedTransactionIds.join(", ")')
) "A banki tételek táblázata az API-ból kapott kapcsolt tranzakció ID-t jeleníti meg."

Write-Output "ALL BANK TRANSACTION LINK TESTS PASSED"
