import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(testDir);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const api = fs.readFileSync(path.join(root, "scripts", "api.js"), "utf8");
const log = fs.readFileSync(path.join(root, "scripts", "activity-log.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.match(html, /id="globalActivityLogPanel"/);
assert.match(html, /id="globalActivityLogToggle"/);
assert.ok(
    html.indexOf('scripts/activity-log.js') < html.indexOf('scripts/api.js'),
    "A naplómodulnak az API előtt kell betöltődnie."
);
assert.match(api, /activityLog\?\.start\(action, params, activityDetails\)/);
assert.match(api, /activityLog\?\.finish\(activityContext, response\)/);
assert.match(api, /activityLog\?\.fail\(activityContext, error\)/);
assert.match(serviceWorker, /scripts\/activity-log\.js/);

const mutationActions = [
    "addTransaction", "addTransactions", "addBankTransactions",
    "refreshHouseCosts", "updateHouseCostSettled", "setBankTransactionMatchStatus",
    "updateTransaction", "bulkMatchTransactions", "deleteTransaction",
    "deleteSharedExpense", "addValueToSet", "refreshSharedExpenses",
    "updateSharedExpense", "addSharedExpense", "updateSharedExpenseRow",
    "setPermission", "addUser"
];
mutationActions.forEach(action => {
    assert.ok(log.includes(`"${action}"`), `Hiányzó naplózott módosító művelet: ${action}`);
});

assert.match(log, /password\|token/);
assert.match(log, /\[REJTETT\]/);
assert.match(log, /MAX_LINES = 2000/);
assert.match(log, /function collectChanges\(details\)/);
assert.match(log, /"VÁLTOZÁS"/);
assert.match(log, /change\.oldValue/);
assert.match(log, /change\.newValue/);

console.log("ALL GLOBAL ACTIVITY LOG STATIC TESTS PASSED");
