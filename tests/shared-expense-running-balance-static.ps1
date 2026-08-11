$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$index = Get-Content -Raw -Encoding UTF8 (Join-Path $root "index.html")
$app = Get-Content -Raw -Encoding UTF8 (Join-Path $root "app.js")
$shared = Get-Content -Raw -Encoding UTF8 (Join-Path $root "features/sharedExp.js")
$calculator = Get-Content -Raw -Encoding UTF8 (Join-Path $root "features/shared-expense-running-balance.js")
$worker = Get-Content -Raw -Encoding UTF8 (Join-Path $root "service-worker.js")

function Assert-Contains([string]$text, [string]$needle, [string]$message) {
    if (-not $text.Contains($needle)) { throw $message }
    Write-Output "PASS: $message"
}

function Assert-Matches([string]$text, [string]$pattern, [string]$message) {
    if ($text -notmatch $pattern) { throw $message }
    Write-Output "PASS: $message"
}

Assert-Matches $index '<th>Rekord hat.sa</th>' "A táblázat megjeleníti az egyes rekordok hatását."
Assert-Matches $index '<th>G.ngy.l.tett egyenleg .+ ki tartozik kinek</th>' "A táblázat egyetlen, egyértelmű göngyölített egyenleget jelenít meg."
Assert-Contains $calculator "signedChange: -amount" "A Dóri által fizetett rész növeli Zsolti tartozását."
Assert-Contains $calculator "signedChange: amount" "A Zsolti által fizetett rész növeli Dóri tartozását, a törlesztés pedig csökkenti Zsolti tartozását."
Assert-Contains $calculator "doriDebt: Math.max(net, 0)" "A nettó pozitív oldal Dóri tartozásaként jelenik meg."
Assert-Contains $calculator "zsoltiDebt: Math.max(-net, 0)" "A nettó negatív oldal Zsolti tartozásaként jelenik meg."
Assert-Contains $shared "runningBalances.byRow.get(row)" "A képernyő minden rekordhoz a hozzá tartozó göngyölített állapotot használja."
Assert-Contains $shared "const headerNet = runningBalances.finalNet" "A fejléc végeredménye ugyanabból a számításból származik."
Assert-Contains $app 'let seSortDirection = "desc"' "A Megosztott költségek alapértelmezett dátumsorrendje csökkenő."
Assert-Contains $shared 'chronologicalIndex.get(a) - chronologicalIndex.get(b)' "A dátum szerinti rendezés a göngyölített egyenleg teljes rekordsorrendjét használja."
Assert-Contains $shared 'await loadSharedExpenses();' "A fejléc rendezése azonnal újrarajzolja a Megosztott költségek táblázatát."
Assert-Matches $shared 'D.ri tartozik Zsoltinak' "A göngyölített egyenleg kiírja, ha Dóri tartozik Zsoltinak."
Assert-Matches $shared 'Zsolti tartozik D.rinak' "A göngyölített egyenleg kiírja, ha Zsolti tartozik Dórinak."
Assert-Contains $worker "shared-expense-running-balance.js?v=45" "A service worker gyorsítótárában szerepel az új számítási modul."

$calculatorPosition = $index.IndexOf('features/shared-expense-running-balance.js?v=45')
$sharedPosition = $index.IndexOf('features/sharedExp.js?v=51')
if ($calculatorPosition -lt 0 -or $sharedPosition -lt 0 -or $calculatorPosition -ge $sharedPosition) {
    throw "Az egyenlegszámító modulnak a Megosztott költségek képernyő kódja előtt kell betöltődnie."
}
Write-Output "PASS: Az egyenlegszámító modul megfelelő sorrendben töltődik be."
Write-Output "ALL SHARED EXPENSE RUNNING BALANCE STATIC TESTS PASSED"
