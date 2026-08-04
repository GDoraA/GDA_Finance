$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$modals = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "ui\modals.js")
$transactions = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "features\transactions.js")

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
    $modals.Contains('function resetStatementItemPicker()') -and
    $modals.Contains('if (hidden) hidden.value = "";') -and
    $modals.Contains('if (picker) picker.innerHTML =') -and
    $modals.Contains('if (selectedSum) selectedSum.textContent = "0";')
) "A banki tételválasztó rejtett értéke, dinamikus checkboxlistája és összegjelzése együtt ürül."

Assert-True (
    $modals.Contains('resetTransactionModalState(form);') -and
    $modals.Contains('resetTransactionModalState();')
) "Az új tranzakció megnyitása és a modal bezárása teljes állapot-visszaállítást végez."

Assert-True (
    $modals -match 'if \(monthEl\) monthEl\.value = "";\s+resetStatementItemPicker\(\);'
) "Másoláskor a korábbi banki kapcsolat nem kerül át az új tranzakcióba."

Assert-True (
    $transactions.Contains('resetTransactionModalState(e.target);')
) "Sikeres mentés után a dinamikus banki tételválasztó is alaphelyzetbe kerül."

Write-Output "ALL TRANSACTION MODAL RESET TESTS PASSED"
