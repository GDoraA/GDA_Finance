$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backend = Get-Content -Raw (Join-Path $projectRoot "backend\Finance_codegs.txt")
$admin = Get-Content -Raw (Join-Path $projectRoot "features\admin.js")
$sidebar = Get-Content -Raw (Join-Path $projectRoot "ui\sidebar.js")

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

$bankActionStart = $backend.IndexOf('action === "getBankTransactions"')
$bankPermission = $backend.IndexOf('requirePermission_(auth, "tx_import", "read")', $bankActionStart)
$bankCacheReturn = $backend.IndexOf('return createJsonOrJsonpResponse_(JSON.parse(cached), callback)', $bankActionStart)

Assert-True ($bankActionStart -ge 0) "A getBankTransactions API-ág létezik."
Assert-True ($bankPermission -gt $bankActionStart) "A banki lista jogosultság-ellenőrzése létezik."
Assert-True ($bankPermission -lt $bankCacheReturn) "A banki jogosultság-ellenőrzés megelőzi a cache visszaadását."

Assert-True (
    $backend.Contains('? "se_settlement_create"') -and
    $backend.Contains(': "se_create"')
) "A törlesztés és a normál megosztott tétel külön backend jogosultságot használ."

Assert-True (
    $admin.Contains('const sel = tr.querySelector("select.perm-access")') -and
    -not $admin.Contains('tbody.querySelectorAll("select.perm-access")')
) "Minden jogosultságválasztó pontosan a saját eseménykezelőjét kapja."

@(
    "transactions",
    "shared",
    "bank-import",
    "reports-monthly",
    "reports-house-costs",
    "bank-matching",
    "value-sets",
    "admin-users",
    "admin-functions",
    "admin-permissions"
) | ForEach-Object {
    Assert-True $sidebar.Contains("`"$_`":") "Az oldal jogosultságvezérelt a menüben: $_"
}

Write-Output "ALL STATIC PERMISSION TESTS PASSED"
