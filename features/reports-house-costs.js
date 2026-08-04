window.reportsHouseCostsPageBridge = window.reportsHouseCostsPageBridge || {
    resetPage() {
        // Jelenleg nincs lapozás vagy külön oldalállapot.
    },
    load(forceRefresh = false) {
        return loadHouseCostsPage(forceRefresh);
    }
};

const HOUSE_COST_CATEGORY_NAGYTETENY = "K01 - Ház költsége - Nagytétény";

let houseCostsCache = null;

function normalizeHouseCostText(value) {
    return String(value || "").trim();
}

function isNagytetenyHouseCost(row) {
    return normalizeHouseCostText(row?.category) === HOUSE_COST_CATEGORY_NAGYTETENY;
}

function isHouseCostSettled(row) {
    const value = normalizeHouseCostText(row?.settled).toLowerCase();
    return value === "x" || value === "1" || value === "true";
}

function parseHouseCostAmount(value) {
    if (typeof parseNumberHu === "function") {
        const parsed = parseNumberHu(value);
        return parsed === null ? 0 : Number(parsed) || 0;
    }

    const n = Number(
        String(value || "")
            .trim()
            .replace(/\s+/g, "")
            .replace(/ft/ig, "")
            .replace(",", ".")
    );

    return Number.isNaN(n) ? 0 : n;
}

function formatHouseCostAmount(value) {
    if (typeof formatAmount === "function") {
        return formatAmount(value);
    }

    return String(Math.abs(Number(value) || 0));
}

function formatHouseCostSignedAmount(value) {
    const amount = Number(value) || 0;
    const formatted = formatHouseCostAmount(Math.abs(amount));
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
    return formatted;
}

function houseCostBalanceClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return "balance-positive";
    if (amount < 0) return "balance-negative";
    return "";
}

function formatHouseCostDate(value) {
    if (typeof formatDateForList === "function") {
        return formatDateForList(value);
    }

    return String(value || "");
}

function escapeHouseCostHtml(value) {
    if (typeof escapeHtml === "function") {
        return escapeHtml(value);
    }

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setHouseCostsText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? "");
}

function renderHouseCostsStatus(message) {
    setHouseCostsText("houseCostsStatus", message || "");
}

function getHouseCostsRowsForDisplay(rows) {
    return (Array.isArray(rows) ? rows : [])
        .filter(isNagytetenyHouseCost)
        .slice()
        .sort((a, b) => {
            const da = new Date(a?.date || "").getTime();
            const db = new Date(b?.date || "").getTime();

            if (Number.isNaN(da) && Number.isNaN(db)) return 0;
            if (Number.isNaN(da)) return 1;
            if (Number.isNaN(db)) return -1;

            return db - da;
        });
}

function getHouseCostParticipantBalances(row) {
    const halfAmount = Math.abs(parseHouseCostAmount(row?.amount)) / 2;
    const paidBy = getHouseCostPayer(row);

    if (paidBy === "dori") {
        return { zsolti: -halfAmount, dori: halfAmount };
    }
    if (paidBy === "zsolti") {
        return { zsolti: halfAmount, dori: -halfAmount };
    }
    return {
        zsolti: parseHouseCostAmount(row?.Zsolti_balance),
        dori: parseHouseCostAmount(row?.Dori_balance)
    };
}

function getHouseCostPayer(row) {
    const paidBy = normalizeHouseCostText(row?.paid_by).toLowerCase();
    if (paidBy.includes("dóri") || paidBy.includes("dori")) return "dori";
    if (paidBy.includes("zsolti")) return "zsolti";
    return "";
}

function calculateHouseCostSettlement(rows) {
    return rows.reduce((result, row) => {
        const amount = Math.abs(parseHouseCostAmount(row?.amount));
        const payer = getHouseCostPayer(row);
        if (payer === "dori") result.doriPaid += amount;
        else if (payer === "zsolti") result.zsoltiPaid += amount;
        else result.unknownPayerCount++;
        result.balance = (result.doriPaid - result.zsoltiPaid) / 2;
        return result;
    }, { doriPaid: 0, zsoltiPaid: 0, balance: 0, unknownPayerCount: 0 });
}

function formatHouseCostSettlement(settlement) {
    if (settlement.unknownPayerCount > 0) {
        return `Nem számítható: ${settlement.unknownPayerCount} tételnél nincs megadva, ki fizette.`;
    }

    const amount = Math.abs(settlement.balance);
    if (amount < 0.005) return "Nincs tartozás";
    if (settlement.balance > 0) {
        return `Zsolti tartozik Dórinak ${formatHouseCostAmount(amount)} Ft-tal`;
    }
    return `Dóri tartozik Zsoltinak ${formatHouseCostAmount(amount)} Ft-tal`;
}

function renderHouseCostsRows(rows) {
    const tbody = document.getElementById("houseCostsBody");

    const displayRows = getHouseCostsRowsForDisplay(rows);
    const balanceRows = displayRows.filter(row => !isHouseCostSettled(row));
    const totalAmount = displayRows.reduce((sum, row) => {
        return sum + Math.abs(parseHouseCostAmount(row?.amount));
    }, 0);
    const settlement = calculateHouseCostSettlement(balanceRows);

    setHouseCostsText("houseCostsCount", `${displayRows.length} db`);
    setHouseCostsText("houseCostsTotal", `${formatHouseCostAmount(totalAmount)} Ft`);
    setHouseCostsText("houseCostsDoriPaid", `${formatHouseCostAmount(settlement.doriPaid)} Ft`);
    setHouseCostsText("houseCostsZsoltiPaid", `${formatHouseCostAmount(settlement.zsoltiPaid)} Ft`);
    setHouseCostsText("houseCostsSettlementBalance", formatHouseCostSettlement(settlement));

    if (!tbody) {
        return;
    }

    if (displayRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14">Nincs megjeleníthető házköltség.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = displayRows.map(row => {
        const amount = Math.abs(parseHouseCostAmount(row?.amount));
        const participantBalances = getHouseCostParticipantBalances(row);
        const zsoltiRowBalance = participantBalances.zsolti;
        const doriRowBalance = participantBalances.dori;
        const settled = isHouseCostSettled(row);
        const canUpdateSettled = typeof hasPermission === "function" &&
            hasPermission("reports_house_costs", "write");
        const sharedExpenseId = normalizeHouseCostText(row?.shared_expense_id);
        const sourceLabel = sharedExpenseId
            ? `Megosztott költség (${sharedExpenseId})`
            : `Tranzakció (${normalizeHouseCostText(row?.transaction_id)})`;

        return `
            <tr class="${settled ? "house-cost-settled-row" : ""}">
                <td>${escapeHouseCostHtml(row?.month || "")}</td>
                <td>${escapeHouseCostHtml(formatHouseCostDate(row?.date))}</td>
                <td class="text-right">${escapeHouseCostHtml(formatHouseCostAmount(amount))} Ft</td>
                <td>${escapeHouseCostHtml(row?.title || "")}</td>
                <td>${escapeHouseCostHtml(row?.paid_by || "")}</td>
                <td class="text-right ${houseCostBalanceClass(zsoltiRowBalance)}">${escapeHouseCostHtml(formatHouseCostSignedAmount(zsoltiRowBalance))} Ft</td>
                <td class="text-right ${houseCostBalanceClass(doriRowBalance)}">${escapeHouseCostHtml(formatHouseCostSignedAmount(doriRowBalance))} Ft</td>
                <td class="text-center">
                    <input type="checkbox"
                        class="house-cost-settled-checkbox"
                        data-id="${escapeHouseCostHtml(row?.id || "")}"
                        ${settled ? "checked" : ""}
                        ${canUpdateSettled ? "" : "disabled"}
                        aria-label="Rendezve">
                </td>
                <td>${escapeHouseCostHtml(row?.payment_type || "")}</td>
                <td>${escapeHouseCostHtml(row?.transaction_type || "")}</td>
                <td>${escapeHouseCostHtml(row?.statement_item || "")}</td>
                <td>${escapeHouseCostHtml(row?.transaction_id || "")}</td>
                <td>${escapeHouseCostHtml(sourceLabel)}</td>
                <td>${escapeHouseCostHtml(row?.updated_at || "")}</td>
            </tr>
        `;
    }).join("");
}

async function loadHouseCostsPage(forceRefresh = false) {
    const tbody = document.getElementById("houseCostsBody");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14">Házköltségek betöltése...</td>
            </tr>
        `;
    }

    renderHouseCostsStatus("Betöltés...");

    if (!forceRefresh && Array.isArray(houseCostsCache)) {
        renderHouseCostsRows(houseCostsCache);
        renderHouseCostsStatus("");
        return;
    }

    let resp;

    try {
        if (!api || typeof api.getHouseCosts !== "function") {
            throw new Error("Hiányzó frontend API metódus: api.getHouseCosts().");
        }

        resp = await api.getHouseCosts();
    } catch (err) {
        console.error("House costs load error:", err);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14">${escapeHouseCostHtml(err?.message || "Hiba a házköltségek betöltésekor.")}</td>
                </tr>
            `;
        }

        renderHouseCostsStatus("Hiba a házköltségek betöltésekor.");
        return;
    }

    if (!resp || resp.success !== true || !Array.isArray(resp.data)) {
        const message =
            resp?.error ||
            resp?.message ||
            "Hibás válasz érkezett a házköltségek lekérésekor.";

        console.warn("House costs unsuccessful response:", resp);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14">${escapeHouseCostHtml(message)}</td>
                </tr>
            `;
        }

        renderHouseCostsStatus(message);
        return;
    }

    houseCostsCache = resp.data;

    renderHouseCostsRows(houseCostsCache);
    renderHouseCostsStatus("");
}

window.loadHouseCostsPage = loadHouseCostsPage;

document.getElementById("refreshHouseCostsBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("refreshHouseCostsBtn");
    if (button) button.disabled = true;
    renderHouseCostsStatus("Frissítés...");

    try {
        const response = await api.refreshHouseCosts();
        if (!response || response.success !== true) {
            throw new Error(response?.error || response?.message || "A frissítés nem sikerült.");
        }

        houseCostsCache = null;
        await loadHouseCostsPage(true);
        renderHouseCostsStatus(
            `Új: ${response.created || 0}, módosítva: ${response.updated || 0}, ` +
            `eltávolítva: ${response.deleted || 0}, duplikáció miatt kihagyva: ${response.duplicates || 0}.`
        );
    } catch (err) {
        console.error("House costs refresh error:", err);
        renderHouseCostsStatus(err?.message || "A frissítés nem sikerült.");
    } finally {
        if (button) button.disabled = false;
    }
});

document.getElementById("houseCostsBody")?.addEventListener("change", async event => {
    const checkbox = event.target?.closest?.(".house-cost-settled-checkbox");
    if (!checkbox) return;

    const id = normalizeHouseCostText(checkbox.getAttribute("data-id"));
    const settled = checkbox.checked;
    if (!id || typeof hasPermission !== "function" || !hasPermission("reports_house_costs", "write")) {
        checkbox.checked = !settled;
        return;
    }

    checkbox.disabled = true;
    renderHouseCostsStatus("Rendezettség mentése...");
    try {
        const response = await api.updateHouseCostSettled(id, settled);
        if (!response || response.success !== true) {
            throw new Error(response?.error || response?.message || "A rendezettség mentése nem sikerült.");
        }

        const cachedRow = Array.isArray(houseCostsCache)
            ? houseCostsCache.find(row => normalizeHouseCostText(row?.id) === id)
            : null;
        if (cachedRow) cachedRow.settled = response.settled || "";
        renderHouseCostsRows(houseCostsCache || []);
        renderHouseCostsStatus("Rendezettség frissítve.");
    } catch (err) {
        console.error("House cost settled update error:", err);
        checkbox.checked = !settled;
        checkbox.disabled = false;
        renderHouseCostsStatus(err?.message || "A rendezettség mentése nem sikerült.");
    }
});
