import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
    path.join(path.dirname(testDir), "features", "reports-house-costs.js"),
    "utf8"
);

const context = vm.createContext({
    console,
    window: {},
    document: { getElementById: () => null },
    formatAmount: value => new Intl.NumberFormat("hu-HU").format(value)
});
vm.runInContext(source, context, { filename: "reports-house-costs.js" });

const rows = [
    { amount: 16000000, paid_by: "Dóri", settled: "" },
    { amount: 400000, paid_by: "Zsolti", settled: "" }
];
const settlement = context.calculateHouseCostSettlement(
    rows.filter(row => !context.isHouseCostSettled(row))
);

assert.equal(settlement.doriPaid, 16000000);
assert.equal(settlement.zsoltiPaid, 400000);
assert.equal(settlement.balance, 7800000);
assert.match(context.formatHouseCostSettlement(settlement), /Zsolti tartozik Dórinak/);
assert.match(context.formatHouseCostSettlement(settlement), /7\s?800\s?000/);

rows[0].settled = "x";
const afterDoriItemSettled = context.calculateHouseCostSettlement(
    rows.filter(row => !context.isHouseCostSettled(row))
);
assert.equal(afterDoriItemSettled.balance, -200000);
assert.match(context.formatHouseCostSettlement(afterDoriItemSettled), /Dóri tartozik Zsoltinak/);

console.log("ALL HOUSE COST SETTLEMENT FRONTEND TESTS PASSED");
