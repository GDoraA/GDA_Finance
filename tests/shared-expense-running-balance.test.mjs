import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
    new URL("../features/shared-expense-running-balance.js", import.meta.url),
    "utf8"
);
const context = { window: {} };
vm.runInNewContext(source, context);

const calculator = context.window.sharedExpenseRunningBalance;
const rows = [
    {
        id: "4",
        date: "2026-01-04",
        title: "Zsolti vásárlása",
        paid_by: "Zsolti",
        Dori_balance: 50
    },
    {
        id: "2",
        date: "2026-01-02",
        title: "Közös költség",
        paid_by: "Zsolti",
        Dori_balance: 20
    },
    {
        id: "1",
        date: "2026-01-01",
        title: "Bevásárlás",
        paid_by: "Dóri",
        Zsolti_balance: 50
    },
    {
        id: "3",
        date: "2026-01-03",
        title: "Törlesztés",
        paid_by: "Zsolti",
        amount: 10
    }
];

const result = calculator.calculate(rows);

assert.deepEqual(
    Array.from(result.chronologicalRows, row => row.id),
    ["1", "2", "3", "4"],
    "A göngyölítésnek a képernyő rendezésétől függetlenül időrendben kell történnie."
);
assert.equal(result.byId.get("1").zsoltiDebt, 50);
assert.equal(result.byId.get("1").doriDebt, 0);
assert.equal(result.byId.get("2").zsoltiDebt, 30);
assert.equal(result.byId.get("3").zsoltiDebt, 20);
assert.equal(result.byId.get("4").doriDebt, 30);
assert.equal(result.byId.get("4").zsoltiDebt, 0);
assert.equal(result.finalNet, 30);

const noEffect = calculator.getRecordEffect({ paid_by: "", amount: 100 });
assert.equal(noEffect.signedChange, 0);
assert.equal(noEffect.kind, "none");

console.log("Shared expense running balance tests passed.");
