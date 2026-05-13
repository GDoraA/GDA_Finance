document.addEventListener("DOMContentLoaded", () => {
    if (typeof initPageBootstrapping === "function") {
        initPageBootstrapping();
    }
    // ===== Datalist betöltés =====
    loadDropdownValues();
});
// ======================================================
// DATALIST ÉRTÉKEK BETÖLTÉSE
// ======================================================
async function loadDropdownValues() {
    const token = localStorage.getItem("gda_auth_token") || "";
    if (!token) {
        return;
    }

    try {
        const result = await api.getValueSets();
        if (!result || !result.success) {
            console.warn(
                "getValueSets unsuccessful response:",
                result?.error || result?.message || result
            );
            return;
        }
        const sets = result.sets || {};
        // Modal datalist-ek
        fillDatalist("titlesList", sets.titles || []);
        fillDatalist("sharedTitlesList", sets.titles || []);
        fillDatalist("categoriesList", sets.categories || []);
        fillDatalist("paymentTypesList", sets.payments || []);
        fillDatalist("transactionTypesList", sets.types || []);
        // Új értékkészlet a fizető felekhez
        fillDatalist("paidByList", sets.paid_by || []);
        // Szűrő datalist-ek
        fillDatalist("filterTitlesList", sets.titles || []);
        fillDatalist("filterCategoriesList", sets.categories || []);
        fillDatalist("filterPaymentsList", sets.payments || []);
        fillDatalist("filterTypesList", sets.types || []);
    } catch (err) {
        console.error("Értékkészletek betöltése sikertelen:", err);
    }
}
// ======================================================
// LISTÁZÁS & SZŰRÉS
// ======================================================
let txCurrentPage = 1;
let txSortField = "date";
let txSortDirection = "desc"; // "asc" | "desc"
let seSortField = "date";
let seSortDirection = "desc";
let seRowsById = new Map(); // shared expense rekord cache id alapján
let bankCurrentPage = 1;
let bankSortField = "transaction_date";
let bankSortDirection = "desc";
let bankFilterTextDebounce = null;
// ===== Bank_Transactions cache (Transactions modal dropdownhoz) =====
let myPermissions = {};
function buildStatementItemOptions(tx, bankItems) {
    const rawTxDate = String(tx?.date ?? "").trim();
    const txDateIso = rawTxDate.includes("T") ? rawTxDate.split("T")[0] : toInputDateLocal(rawTxDate);
    const txAmt = Number(tx?.amount);
    const matches = (bankItems || []).filter(b => {
        const bDateIso = String(b?.transaction_date ?? "").trim();
        const bAmt = Number(b?.amount);
        if (!txDateIso) return false;
        if (!bDateIso) return false;
        if (Number.isNaN(txAmt) || Number.isNaN(bAmt)) return false;
        return (bDateIso === txDateIso) && (Math.abs(bAmt) === Math.abs(txAmt));
    });
    // opció szöveg: id + partner + memo (ha van)
    const opts = [
        `<option value="">— válassz banki tételt —</option>`,
        ...matches.map(b => {
            const id = String(b?.id ?? "").trim();
            const partner = String(b?.partner_name ?? "").trim();
            const memo = String(b?.memo ?? "").trim();
            const label = [id, partner, memo].filter(Boolean).join(" | ");
            return `<option value="${id}">${label || id}</option>`;
        })
    ];
    return opts.join("");
}
function buildStatementItemSelectHtml(tx) {
    // statement_item = kiválasztott bank tranzakció id (string)
    const selectedId = String(tx?.statement_item ?? "").trim();
    // dropdown alapból üres opciókkal (később töltjük async)
    // fontos: a táblázat renderelése szinkron, ezért az async betöltést utólag végezzük
    const safeTxId = String(tx?.id ?? "").trim();
    // Egyedi azonosító, hogy később megtaláljuk és feltöltsük
    const selectId = `stmt_${safeTxId}`;
    // Placeholder: amíg a bankTxCache be nem jön
    return `
  <button type="button"
          id="${selectId}"
          class="statement-item-picker-btn"
          data-tx-id="${safeTxId}">
    ${selectedId ? `#${selectedId}` : "Banki tétel kiválasztása"}
  </button>
  <div class="statement-item-picker-popover" id="${selectId}_pop" data-open="0"></div>
`;
}