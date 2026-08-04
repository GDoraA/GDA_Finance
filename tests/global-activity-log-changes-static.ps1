$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$api = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "scripts\api.js")
$activityLog = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "scripts\activity-log.js")
$transactions = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "features\transactions.js")
$modals = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot "ui\modals.js")

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
    $api.Contains('function jsonp(action, params = {}, activityDetails = null)') -and
    $api.Contains('activityLog?.start(action, params, activityDetails)')
) "Az API külön, a szervernek el nem küldött változási kontextust ad át a naplónak."

Assert-True (
    $activityLog.Contains('function collectChanges(details)') -and
    $activityLog.Contains('oldValue') -and
    $activityLog.Contains('newValue') -and
    $activityLog.Contains('context.changes.forEach(change =>')
) "A változásnapló mezőnként előállítja és kiírja a régi és új értéket."

Assert-True (
    $activityLog -match 'if \(response\?\.success === false\)[\s\S]+?return;[\s\S]+?context\.changes\.forEach'
) "A pontos változások csak sikeres szerverválasz után kerülnek a naplóba."

Assert-True (
    $transactions.Contains('api.updateTransaction(payload, tx)') -and
    $transactions.Contains('api.updateTransaction(formData, previousTransaction)') -and
    $transactions.Contains('e.target._activityOriginalTransaction') -and
    $modals.Contains('txForm._activityOriginalTransaction = { ...tx };')
) "Az inline és a modalos tranzakciómódosítás is átadja a korábbi rekordállapotot."

Write-Output "ALL GLOBAL ACTIVITY LOG CHANGE TESTS PASSED"
