let monthlySummarySortField = "month";
let monthlySummarySortDirection = "desc"; // "asc" | "desc"
let monthlySummaryRowsCache = [];

window.reportsMonthlyPageBridge = window.reportsMonthlyPageBridge || {
    resetPage() {
        // Rendezés megőrzése oldalváltáskor: tudatos no-op.
    },
    load() {
        return loadMonthlySummaryPage();
    }
};

function renderMonthlySummaryStatus(message) {
    const statusEl = document.getElementById("monthlySummaryStatus");
    if (!statusEl) return;
    statusEl.textContent = String(message || "");
}

function updateMonthlySummarySortIcons() {
    document.querySelectorAll("#monthlySummaryTable thead th[data-sort]").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");

        if (th.getAttribute("data-sort") === monthlySummarySortField) {
            th.classList.add(
                monthlySummarySortDirection === "asc" ? "sort-asc" : "sort-desc"
            );
        }
    });
}

function getMonthlySummarySortedRows(rows) {
    const safeRows = Array.isArray(rows) ? rows.slice() : [];
    const field = String(monthlySummarySortField || "month");
    const dir = monthlySummarySortDirection === "desc" ? -1 : 1;

    const numericFields = new Set([
        "income",
        "expenseDisplay",
        "saving",
        "monthlyBalance",
        "cumulativeBalance"
    ]);

    return safeRows.sort((a, b) => {
        const va = a?.[field];
        const vb = b?.[field];

        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;

        if (numericFields.has(field)) {
            const na = Number(va);
            const nb = Number(vb);

            if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
            if (Number.isNaN(na)) return 1;
            if (Number.isNaN(nb)) return -1;

            return (na - nb) * dir;
        }

        return String(va).localeCompare(String(vb), "hu") * dir;
    });
}

function getMonthlySummaryClosingCumulativeBalance(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];

    const latestRow = safeRows
        .slice()
        .sort((a, b) => String(a?.month || "").localeCompare(String(b?.month || ""), "hu"))
        .at(-1);

    return Number(latestRow?.cumulativeBalance) || 0;
}

function renderMonthlySummaryRows(rows) {
    const tbody = document.getElementById("monthlySummaryBody");
    if (!tbody) return;

    if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">Nincs megjeleníthető havi adat.</td>
            </tr>
        `;
        return;
    }

    const totals = rows.reduce((acc, row) => {
        acc.income += Number(row.income) || 0;
        acc.expenseDisplay += Number(row.expenseDisplay) || 0;
        acc.saving += Number(row.saving) || 0;
        acc.monthlyBalance += Number(row.monthlyBalance) || 0;
        return acc;
    }, {
        income: 0,
        expenseDisplay: 0,
        saving: 0,
        monthlyBalance: 0
    });

    const displayRows = getMonthlySummarySortedRows(rows);
    const lastCumulativeBalance = getMonthlySummaryClosingCumulativeBalance(rows);

    const bodyRowsHtml = displayRows.map((row) => `
    <tr>
        <td>${escapeHtml(String(row.month || ""))}</td>
        <td class="text-right">${escapeHtml(formatAmount(row.income))} Ft</td>
        <td class="text-right">${escapeHtml(formatAmount(row.expenseDisplay))} Ft</td>
        <td class="text-right">${escapeHtml(formatAmount(row.saving))} Ft</td>
        <td class="text-right ${row.monthlyBalance < 0 ? "amount-expense" : "amount-income"}">
            ${escapeHtml(formatSignedAmount(row.monthlyBalance))} Ft
        </td>
        <td class="text-right ${row.cumulativeBalance < 0 ? "amount-expense" : "amount-income"}">
            ${escapeHtml(formatSignedAmount(row.cumulativeBalance))} Ft
        </td>
    </tr>
`).join("");

    const totalsRowHtml = `
        <tr class="monthly-summary-total-row">
            <td><strong>Összesen</strong></td>
            <td class="text-right"><strong>${escapeHtml(formatAmount(totals.income))} Ft</strong></td>
            <td class="text-right"><strong>${escapeHtml(formatAmount(totals.expenseDisplay))} Ft</strong></td>
            <td class="text-right"><strong>${escapeHtml(formatAmount(totals.saving))} Ft</strong></td>
            <td class="text-right ${totals.monthlyBalance < 0 ? "amount-expense" : "amount-income"}">
                <strong>${escapeHtml(formatSignedAmount(totals.monthlyBalance))} Ft</strong>
            </td>
            <td class="text-right ${lastCumulativeBalance < 0 ? "amount-expense" : "amount-income"}">
                <strong>${escapeHtml(formatSignedAmount(lastCumulativeBalance))} Ft</strong>
            </td>
        </tr>
    `;

    tbody.innerHTML = bodyRowsHtml + totalsRowHtml;
}

function getMonthlySummaryMonthKey(tx) {
    const rawMonth = String(tx?.month || "").trim();
    if (/^\d{6}$/.test(rawMonth)) return rawMonth;

    const rawDate = String(tx?.date || "").trim();
    if (!rawDate) return "";

    const derived = deriveMonth(rawDate);
    return /^\d{6}$/.test(derived) ? derived : "";
}

function normalizeMonthlySummaryTitle(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s*-\s*/g, " - ")
        .replace(/\s+/g, " ");
}

function classifyMonthlySummaryType(transactionType) {
    const t = String(transactionType || "").trim().toLowerCase();

    if (t.includes("bev") || t === "income") return "income";
    if (t.includes("kiad") || t === "expense") return "expense";
    if (t.includes("megtak") || t === "saving") return "saving";

    return "";
}

function buildMonthlySummaryRows(transactions) {
    const monthlyMap = new Map();

    (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
        const monthKey = getMonthlySummaryMonthKey(tx);
        if (!monthKey) return;

        const amount = Number(tx?.amount);
        if (Number.isNaN(amount)) return;

        const titleText = normalizeMonthlySummaryTitle(tx?.title);
        const isSavingSpendTitle = titleText === "megtakaritas - koltes";

        const type = classifyMonthlySummaryType(tx?.transaction_type);
        if (!type && !isSavingSpendTitle) return;

        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
                month: monthKey,
                income: 0,
                expenseRaw: 0,
                saving: 0,
                savingSpend: 0
            });
        }

        const bucket = monthlyMap.get(monthKey);

        if (type === "income") {
            bucket.income += amount;
            return;
        }

        if (type === "expense") {
            bucket.expenseRaw += amount;
            return;
        }

if (isSavingSpendTitle) {
    const absAmount = Math.abs(amount);
    bucket.saving -= absAmount;
    bucket.savingSpend += absAmount;
    return;
}

if (type === "saving") {
    bucket.saving += amount;
}
    });

    const sortedMonths = Array.from(monthlyMap.keys()).sort((a, b) => a.localeCompare(b, "hu"));

    let cumulativeBalance = 0;

    return sortedMonths.map((monthKey) => {
        const bucket = monthlyMap.get(monthKey);
        const expenseDisplay = Math.abs(bucket.expenseRaw);
const monthlyBalance = bucket.income - Math.abs(bucket.expenseRaw) + bucket.savingSpend;
        cumulativeBalance += monthlyBalance;

        return {
            month: bucket.month,
            income: bucket.income,
            expenseDisplay,
            saving: bucket.saving,
            monthlyBalance,
            cumulativeBalance
        };
    });
}
async function getTransactionsForMonthlySummary() {
    try {
        // 1) cache használat, ha van
        if (window.transactionsPageBridge) {
            const cached = window.transactionsPageBridge.getCache?.();
            if (Array.isArray(cached)) {
                return cached;
            }

            // 2) cache betöltés bridge-en keresztül
            const ensured = await window.transactionsPageBridge.ensureCache?.();
            if (Array.isArray(ensured)) {
                return ensured;
            }
        }
    } catch (e) {
        console.warn("transactionsPageBridge hiba, fallback API-ra:", e);
    }

    // 3) fallback API
    const resp = await api.getTransactions();
    if (!resp || resp.success !== true || !Array.isArray(resp.data)) {
        throw new Error(
            resp?.error ||
            resp?.message ||
            "Nem sikerült lekérni a tranzakciókat."
        );
    }

    return resp.data;
}
function initMonthlySummarySortHandlers() {
    const table = document.getElementById("monthlySummaryTable");
    if (!table || table.dataset.sortInitialized === "1") return;

    table.querySelectorAll("thead th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const field = th.getAttribute("data-sort");
            if (!field) return;

            if (monthlySummarySortField === field) {
                monthlySummarySortDirection =
                    monthlySummarySortDirection === "asc" ? "desc" : "asc";
            } else {
                monthlySummarySortField = field;
                monthlySummarySortDirection = "asc";
            }

            updateMonthlySummarySortIcons();
            renderMonthlySummaryRows(monthlySummaryRowsCache);
        });
    });

    table.dataset.sortInitialized = "1";
}

async function loadMonthlySummaryPage() {
    initMonthlySummarySortHandlers();
    updateMonthlySummarySortIcons();

    const tbody = document.getElementById("monthlySummaryBody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">Betöltés...</td>
            </tr>
        `;
    }

    renderMonthlySummaryStatus("Havi összesítő betöltése...");

    let transactions;
    try {
        transactions = await getTransactionsForMonthlySummary();
    } catch (err) {
        console.error("Havi összesítő betöltése sikertelen:", err);
        renderMonthlySummaryStatus("Nem sikerült betölteni a havi összesítőt.");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">Nem sikerült betölteni a havi összesítőt.</td>
                </tr>
            `;
        }
        return;
    }
    if (!Array.isArray(transactions)) {
        console.warn("Havi összesítő sikertelen adat:", transactions);
        renderMonthlySummaryStatus("Nem sikerült betölteni a havi összesítőt.");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">Nem sikerült betölteni a havi összesítőt.</td>
                </tr>
            `;
        }
        return;
    }

    const rows = buildMonthlySummaryRows(transactions);
    monthlySummaryRowsCache = rows;
    renderMonthlySummaryRows(monthlySummaryRowsCache);

    if (!rows.length) {
        renderMonthlySummaryStatus("Nincs megjeleníthető havi adat.");
        return;
    }

    renderMonthlySummaryStatus("A riport sikeresen betöltött.");
}

window.loadMonthlySummaryPage = loadMonthlySummaryPage;