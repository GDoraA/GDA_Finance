import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(testDir);
const source = fs.readFileSync(
    path.join(root, "features", "transactions-category-chart.js"),
    "utf8"
);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const context = vm.createContext({
    console,
    Intl,
    window: {},
    document: {
        getElementById: () => null,
        addEventListener: () => {}
    }
});
vm.runInContext(source, context, { filename: "transactions-category-chart.js" });

const result = context.window.transactionsCategoryChart.aggregateTransactionsByCategory([
    { category: "Élelmiszer", amount: -10000 },
    { category: "Élelmiszer", amount: "5 000" },
    { category: "Rezsi", amount: 12000 },
    { category: "", amount: -3000 },
    { category: "Nulla", amount: 0 }
]);

assert.equal(result.total, 30000);
assert.equal(result.transactionCount, 4);
assert.deepEqual(
    Array.from(result.items, item => [item.category, item.amount, item.count]),
    [
        ["Élelmiszer", 15000, 2],
        ["Rezsi", 12000, 1],
        ["Nincs kategória", 3000, 1]
    ]
);
assert.equal(Math.round(result.items.reduce((sum, item) => sum + item.percentage, 0)), 100);
assert.match(html, /id="openCategoryChartBtn"/);
assert.match(html, /id="categoryChartModal"/);
assert.match(html, /id="categoryPieChart"/);
assert.match(source, /class="category-pie-slice"/);
assert.match(source, /data-tooltip=/);
assert.match(source, /addEventListener\("mouseenter"/);
assert.match(source, /addEventListener\("focus"/);
assert.ok(
    html.indexOf("features/transactions.js") < html.indexOf("features/transactions-category-chart.js"),
    "A diagrammodulnak a tranzakciós modul után kell betöltődnie."
);
assert.match(serviceWorker, /features\/transactions-category-chart\.js/);

console.log("ALL TRANSACTIONS CATEGORY CHART TESTS PASSED");
