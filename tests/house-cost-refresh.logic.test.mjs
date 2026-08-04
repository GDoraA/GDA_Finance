import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(testDir);
const backendSource = fs.readFileSync(path.join(root, "backend", "Finance_codegs.txt"), "utf8");

class MockRange {
    constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
        this.sheet = sheet;
        this.row = row;
        this.column = column;
        this.rowCount = rowCount;
        this.columnCount = columnCount;
    }

    getValues() {
        const values = [];
        for (let r = 0; r < this.rowCount; r++) {
            const outputRow = [];
            for (let c = 0; c < this.columnCount; c++) {
                outputRow.push(this.sheet.data[this.row - 1 + r]?.[this.column - 1 + c] ?? "");
            }
            values.push(outputRow);
        }
        return values;
    }

    setValues(values) {
        this.sheet.setValuesCalls++;
        for (let r = 0; r < values.length; r++) {
            const targetRow = this.row - 1 + r;
            while (this.sheet.data.length <= targetRow) this.sheet.data.push([]);
            for (let c = 0; c < values[r].length; c++) {
                this.sheet.data[targetRow][this.column - 1 + c] = values[r][c];
            }
        }
        return this;
    }

    setValue(value) {
        return this.setValues([[value]]);
    }

    clearContent() {
        this.sheet.clearContentCalls++;
        for (let r = 0; r < this.rowCount; r++) {
            for (let c = 0; c < this.columnCount; c++) {
                const targetRow = this.row - 1 + r;
                if (this.sheet.data[targetRow]) {
                    this.sheet.data[targetRow][this.column - 1 + c] = "";
                }
            }
        }
        while (
            this.sheet.data.length > 1 &&
            this.sheet.data[this.sheet.data.length - 1].every(value => value === "")
        ) {
            this.sheet.data.pop();
        }
        return this;
    }
}

class MockSheet {
    constructor(name, data) {
        this.name = name;
        this.data = data.map(row => row.slice());
        this.dataRangeReads = 0;
        this.setValuesCalls = 0;
        this.clearContentCalls = 0;
    }

    getName() {
        return this.name;
    }

    getLastColumn() {
        return this.data.reduce((max, row) => Math.max(max, row.length), 0);
    }

    getLastRow() {
        return this.data.length;
    }

    getDataRange() {
        this.dataRangeReads++;
        return new MockRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
    }

    getRange(row, column, rowCount = 1, columnCount = 1) {
        return new MockRange(this, row, column, rowCount, columnCount);
    }

    appendRow(row) {
        this.data.push(row.slice());
    }

    deleteRow(row) {
        this.data.splice(row - 1, 1);
    }
}

class MockSpreadsheet {
    constructor(sheets) {
        this.sheets = new Map(sheets.map(sheet => [sheet.getName(), sheet]));
    }

    getSheetByName(name) {
        return this.sheets.get(name) || null;
    }
}

let uuidCounter = 0;
let activeSpreadsheet = null;
const context = vm.createContext({
    console,
    Utilities: {
        getUuid() {
            uuidCounter++;
            return `${String(uuidCounter).padStart(10, "0")}-0000-0000-0000-000000000000`;
        },
        formatDate(value, _timezone, format) {
            const date = new Date(value);
            const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
            const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(date.getUTCDate()).padStart(2, "0");
            if (format === "yyyy-MM-dd") return `${yyyy}-${mm}-${dd}`;
            if (format === "yyyy.MM.dd.") return `${yyyy}.${mm}.${dd}.`;
            return `${yyyy}-${mm}-${dd} 00:00:00`;
        }
    },
    Session: {
        getScriptTimeZone() {
            return "Europe/Budapest";
        }
    },
    SpreadsheetApp: {
        getActive() {
            return activeSpreadsheet;
        }
    }
});

vm.runInContext(backendSource, context, { filename: "Finance_codegs.txt" });

const transactionHeader = [
    "id", "month", "date", "amount", "title", "category",
    "payment_type", "transaction_type", "is_shared", "statement_item"
];
const sharedHeader = [
    "id", "created_at", "transaction_id", "month", "date", "title", "amount",
    "paid_by", "Zsolti_amount", "Dori_amount", "remaining_amount",
    "Zsolti_balance", "Dori_balance", "balance_impact", "notes", "category"
];
const houseHeader = [
    "id", "transaction_id", "month", "date", "title", "amount", "category",
    "payment_type", "transaction_type", "statement_item", "created_at",
    "updated_at", "shared_expense_id", "paid_by", "Zsolti_balance", "Dori_balance", "settled"
];
const houseCategory = "K01 - Ház költsége - Nagytétény";

const transactions = new MockSheet("Transactions", [
    transactionHeader,
    ["TR-1", "202601", "2026-01-10", 100, "Tető", houseCategory, "Kártya", "Kiadás", "x", "BT-1"],
    ["TR-2", "202601", "2026-01-11", 80, "Élelmiszer", "Élelmiszer", "Kártya", "Kiadás", "x", "BT-2"]
]);
const shared = new MockSheet("Shared_Expenses", [
    sharedHeader,
    ["SE-1", "", "TR-1", "202601", "2026-01-10", "Tető", 100, "Dóri", 0, 0, 100, 50, 50, 50, "", houseCategory],
    ["SE-2", "", "", "202601", "2026-01-12", "Kazán", 60, "Zsolti", 0, 0, 60, 45, 15, 15, "", houseCategory],
    ["SE-3", "", "", "202601", "2026-01-13", "Mozi", 20, "Zsolti", 0, 0, 20, 10, 10, 10, "", "Szórakozás"]
]);
const house = new MockSheet("House_Costs", [
    houseHeader,
    ["HC-1", "TR-1", "202601", "2026.01.10.", "Régi tető", 90, houseCategory, "", "", "", "", "", ""],
    ["HC-2", "", "202601", "2026.01.12.", "Régi kazán", 50, houseCategory, "", "", "", "", "", "SE-2"],
    ["HC-3", "", "202601", "2026.01.01.", "Árva", 10, houseCategory, "", "", "", "", "", "SE-999"]
]);

activeSpreadsheet = new MockSpreadsheet([transactions, shared, house]);
const refreshResult = context.refreshHouseCosts_();
assert.equal(refreshResult.success, true);
assert.equal(refreshResult.duplicates, 1);
assert.ok(Array.isArray(refreshResult.log));
assert.ok(refreshResult.log.some(line => line.includes("LÉTREHOZVA") || line.includes("FRISSÍTVE")));
assert.ok(refreshResult.log.some(line => line.includes("KIHAGYVA (duplikáció)")));
assert.ok(refreshResult.log.some(line => line.includes("Frissítés kész")));

const houseObjects = house.data.slice(1).map(row =>
    Object.fromEntries(houseHeader.map((name, index) => [name, row[index] ?? ""]))
);
assert.equal(houseObjects.length, 2, "Csak a közvetlen TR-1 és a kézi SE-2 maradhat.");
assert.equal(houseObjects.filter(row => row.transaction_id === "TR-1").length, 1);
assert.equal(houseObjects.find(row => row.transaction_id === "TR-1").amount, 100);
assert.equal(houseObjects.find(row => row.shared_expense_id === "SE-2").amount, 60);
assert.equal(houseObjects.find(row => row.transaction_id === "TR-1").paid_by, "Dóri");
assert.equal(houseObjects.find(row => row.transaction_id === "TR-1").Zsolti_balance, -50);
assert.equal(houseObjects.find(row => row.transaction_id === "TR-1").Dori_balance, 50);
assert.equal(houseObjects.find(row => row.shared_expense_id === "SE-2").paid_by, "Zsolti");
assert.equal(houseObjects.find(row => row.shared_expense_id === "SE-2").Zsolti_balance, 30);
assert.equal(houseObjects.find(row => row.shared_expense_id === "SE-2").Dori_balance, -30);
assert.equal(
    houseObjects.reduce((sum, row) => sum + Number(row.Zsolti_balance || 0), 0),
    -20,
    "Zsolti nettó egyenlege figyelembe veszi, hogy melyik tételt ki fizette."
);
assert.equal(
    houseObjects.reduce((sum, row) => sum + Number(row.Dori_balance || 0), 0),
    20,
    "Dóri nettó egyenlege Zsolti egyenlegének ellenpárja."
);
assert.equal(houseObjects.some(row => row.shared_expense_id === "SE-1"), false);
assert.equal(houseObjects.some(row => row.shared_expense_id === "SE-999"), false);

const settleResult = context.updateHouseCostSettled_("HC-1", "x");
assert.equal(settleResult.success, true);
assert.equal(settleResult.settled, "x");
const secondHouseRefresh = context.refreshHouseCosts_();
assert.equal(secondHouseRefresh.created, 0, "Az ismételt frissítés nem hozhat létre új sort.");
assert.equal(secondHouseRefresh.updated, 0, "Az ismételt frissítés változás nélkül nem írhat át sort.");
assert.equal(secondHouseRefresh.deleted, 0, "Az ismételt frissítés változás nélkül nem törölhet sort.");
const settledHouseObjects = house.data.slice(1).map(row =>
    Object.fromEntries(houseHeader.map((name, index) => [name, row[index] ?? ""]))
);
assert.equal(settledHouseObjects.find(row => row.id === "HC-1").settled, "x");
assert.equal(
    settledHouseObjects
        .filter(row => row.settled !== "x")
        .reduce((sum, row) => sum + Number(row.Zsolti_balance || 0), 0),
    30,
    "A rendezett tétel nem számíthat bele a nettó egyenlegbe."
);

const sharedWithoutCategory = new MockSheet("Shared_Expenses", [
    sharedHeader.slice(0, -1),
    ["SE-10", "", "TR-1", "202601", "2026-01-10", "Tető", 100, "Dóri", 0, 0, 100, 50, 50, 50, ""]
]);
activeSpreadsheet = new MockSpreadsheet([transactions, sharedWithoutCategory, house]);
const sharedRefreshResult = context.refreshSharedExpensesFromTransactions_();
assert.equal(sharedRefreshResult.success, true);
const categoryIndex = sharedWithoutCategory.data[0].indexOf("category");
assert.notEqual(categoryIndex, -1);
assert.equal(sharedWithoutCategory.data[1][categoryIndex], houseCategory);
const secondSharedRefresh = context.refreshSharedExpensesFromTransactions_();
assert.equal(secondSharedRefresh.updated, 0, "A második kategóriafrissítésnek idempotensnek kell lennie.");

const emptyTransactions = new MockSheet("Transactions", [transactionHeader]);
const manuallyAddedShared = new MockSheet("Shared_Expenses", [sharedHeader]);
const emptyHouse = new MockSheet("House_Costs", [houseHeader]);
activeSpreadsheet = new MockSpreadsheet([emptyTransactions, manuallyAddedShared, emptyHouse]);
const addManualResult = context.addSharedExpense_({
    date: "2026-07-31",
    title: "Kézi házköltség",
    category: houseCategory,
    amount: 12500,
    paid_by: "Zsolti",
    Zsolti_amount: 0,
    Dori_amount: 0,
    notes: ""
});
assert.equal(addManualResult.success, true);
const manualRefreshResult = context.refreshHouseCosts_();
assert.equal(manualRefreshResult.created, 1);
assert.equal(emptyHouse.data.length, 2, "A kézzel felvett K01-es megosztott tételnek be kell kerülnie.");
assert.equal(emptyHouse.data[1][houseHeader.indexOf("amount")], 12500);
assert.equal(emptyHouse.data[1][houseHeader.indexOf("paid_by")], "Zsolti");
assert.equal(emptyHouse.data[1][houseHeader.indexOf("Zsolti_balance")], 6250);
assert.equal(emptyHouse.data[1][houseHeader.indexOf("Dori_balance")], -6250);

emptyTransactions.data.push([
    "TR-DORI", "202607", "2026-07-31", 9000, "Közvetlen házköltség",
    houseCategory, "Kártya", "Kiadás", "", "BT-DORI"
]);
context.refreshHouseCosts_();
const directDoriRow = emptyHouse.data.find(row => row[houseHeader.indexOf("transaction_id")] === "TR-DORI");
assert.ok(directDoriRow, "A közvetlen tranzakciónak be kell kerülnie a riportba.");
assert.equal(
    directDoriRow[houseHeader.indexOf("paid_by")],
    "Dóri",
    "A Tranzakciók lapról érkező házköltséget mindig Dóri fizette."
);
assert.equal(
    directDoriRow[houseHeader.indexOf("Zsolti_balance")],
    -4500,
    "Dóri fizetésekor Zsolti egyenlege tartozás."
);
assert.equal(
    directDoriRow[houseHeader.indexOf("Dori_balance")],
    4500,
    "Dóri fizetésekor Dóri egyenlege követelés."
);
emptyTransactions.data[1][transactionHeader.indexOf("amount")] = 10000;
const balanceUpdateResult = context.refreshHouseCosts_();
assert.equal(balanceUpdateResult.updated, 1, "Az összegváltozásnak frissítenie kell a riport sort.");
const updatedDirectDoriRow = emptyHouse.data.find(
    row => row[houseHeader.indexOf("transaction_id")] === "TR-DORI"
);
assert.equal(updatedDirectDoriRow[houseHeader.indexOf("Zsolti_balance")], -5000);
assert.equal(updatedDirectDoriRow[houseHeader.indexOf("Dori_balance")], 5000);

const manyTransactionRows = [transactionHeader];
for (let i = 1; i <= 2000; i++) {
    manyTransactionRows.push([
        `TR-${i}`, "202607", "2026-07-31", i, `Tétel ${i}`,
        i % 10 === 0 ? houseCategory : "Egyéb",
        "Kártya", "Kiadás", i % 2 === 0 ? "x" : "", `BT-${i}`
    ]);
}
const manyTransactions = new MockSheet("Transactions", manyTransactionRows);
const manyShared = new MockSheet("Shared_Expenses", [sharedHeader]);
const manyHouse = new MockSheet("House_Costs", [houseHeader]);
activeSpreadsheet = new MockSpreadsheet([manyTransactions, manyShared, manyHouse]);
context.refreshSharedExpensesFromTransactions_();
manyTransactions.dataRangeReads = 0;
manyShared.dataRangeReads = 0;
manyHouse.dataRangeReads = 0;
manyTransactions.setValuesCalls = 0;
manyShared.setValuesCalls = 0;
manyHouse.setValuesCalls = 0;
const bulkResult = context.refreshHouseCosts_();
assert.equal(bulkResult.success, true);
assert.equal(manyHouse.data.length, 201, "A 2000 tranzakcióból 200 közvetlen K01-es sor várható.");
assert.equal(manyTransactions.dataRangeReads, 1);
assert.equal(manyShared.dataRangeReads, 1);
assert.equal(manyHouse.dataRangeReads, 1);
assert.equal(manyHouse.setValuesCalls, 1, "A Házköltségek frissítése egyetlen tömbösített írást használjon.");

console.log("ALL HOUSE COST REFRESH LOGIC TESTS PASSED");
