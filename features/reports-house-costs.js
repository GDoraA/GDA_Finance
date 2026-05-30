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

function renderHouseCostsRows(rows) {
    const tbody = document.getElementById("houseCostsBody");

    const displayRows = getHouseCostsRowsForDisplay(rows);
    const totalAmount = displayRows.reduce((sum, row) => {
        return sum + Math.abs(parseHouseCostAmount(row?.amount));
    }, 0);

    setHouseCostsText("houseCostsCount", `${displayRows.length} db`);
    setHouseCostsText("houseCostsTotal", `${formatHouseCostAmount(totalAmount)} Ft`);

    if (!tbody) {
        return;
    }

    if (displayRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">Nincs megjeleníthető házköltség.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = displayRows.map(row => {
        const amount = Math.abs(parseHouseCostAmount(row?.amount));

        return `
            <tr>
                <td>${escapeHouseCostHtml(row?.month || "")}</td>
                <td>${escapeHouseCostHtml(formatHouseCostDate(row?.date))}</td>
                <td class="text-right">${escapeHouseCostHtml(formatHouseCostAmount(amount))} Ft</td>
                <td>${escapeHouseCostHtml(row?.title || "")}</td>
                <td>${escapeHouseCostHtml(row?.payment_type || "")}</td>
                <td>${escapeHouseCostHtml(row?.transaction_type || "")}</td>
                <td>${escapeHouseCostHtml(row?.statement_item || "")}</td>
                <td>${escapeHouseCostHtml(row?.transaction_id || "")}</td>
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
                <td colspan="9">Házköltségek betöltése...</td>
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
                    <td colspan="9">${escapeHouseCostHtml(err?.message || "Hiba a házköltségek betöltésekor.")}</td>
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
                    <td colspan="9">${escapeHouseCostHtml(message)}</td>
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