window.reportsMonthlyPageBridge = window.reportsMonthlyPageBridge || {
    resetPage() {
        // Ebben a release-ben még nincs külön page-state, ezért tudatos no-op.
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

    const lastCumulativeBalance = Number(rows[rows.length - 1]?.cumulativeBalance) || 0;

    const bodyRowsHtml = rows.map((row) => `
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

        const type = classifyMonthlySummaryType(tx?.transaction_type);
        if (!type) return;

        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
                month: monthKey,
                income: 0,
                expenseRaw: 0,
                saving: 0
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

        if (type === "saving") {
            bucket.saving += amount;
        }
    });

    const sortedMonths = Array.from(monthlyMap.keys()).sort((a, b) => a.localeCompare(b, "hu"));

    let cumulativeBalance = 0;

    return sortedMonths.map((monthKey) => {
        const bucket = monthlyMap.get(monthKey);
        const expenseDisplay = Math.abs(bucket.expenseRaw);
        const monthlyBalance = bucket.income - Math.abs(bucket.expenseRaw);

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

async function loadMonthlySummaryPage() {
    const tbody = document.getElementById("monthlySummaryBody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">Betöltés...</td>
            </tr>
        `;
    }

    renderMonthlySummaryStatus("Havi összesítő betöltése...");

    let response;
    try {
        response = await api.getTransactions();
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

    if (!response || response.success !== true || !Array.isArray(response.data)) {
        console.warn("Havi összesítő sikertelen válasz:", response);
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

    const rows = buildMonthlySummaryRows(response.data);
    renderMonthlySummaryRows(rows);

    if (!rows.length) {
        renderMonthlySummaryStatus("Nincs megjeleníthető havi adat.");
        return;
    }

    renderMonthlySummaryStatus("A riport sikeresen betöltött.");
}

window.loadMonthlySummaryPage = loadMonthlySummaryPage;