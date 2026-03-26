document.addEventListener("DOMContentLoaded", () => {
    if (typeof initPageBootstrapping === "function") {
        initPageBootstrapping();
    }

    // ===== Datalist betöltés =====
    loadDropdownValues();

});
// ======================================================
// FORMÁZÓ FÜGGVÉNYEK – DÁTUM, ÖSSZEG
// ======================================================
function formatAmount(amount) {
    if (amount === null || amount === undefined) return "";
    // szóközök eltávolítása, majd számmá alakítás
    const num = Number(String(amount).replace(/\s/g, ""));
    if (isNaN(num)) {
        // ha nem értelmezhető számként, akkor eredeti értéket adjuk vissza
        return String(amount);
    }
    // ez teszi bele a szóközöket ezres csoportosítással
    return Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function formatSignedAmount(amount) {
    if (amount === null || amount === undefined) return "";
    const num = Number(String(amount).replace(/\s/g, ""));
    if (isNaN(num)) return String(amount);
    const sign = num < 0 ? "-" : "";
    return sign + formatAmount(Math.abs(num));
}
// ======================================================
// DATALIST ÉRTÉKEK BETÖLTÉSE
// ======================================================
async function loadDropdownValues() {
    const result = await api.getValueSets();
    if (!result || !result.success) return;
    const sets = result.sets;
    // Modal datalist-ek
    fillDatalist("titlesList", sets.titles);
    fillDatalist("sharedTitlesList", sets.titles);
    fillDatalist("categoriesList", sets.categories);
    fillDatalist("paymentTypesList", sets.payments);
    fillDatalist("transactionTypesList", sets.types);
    fillDatalist("paidByList", sets.paid_by || []);
    // Új értékkészlet a fizető felekhez
    fillDatalist("paidByList", sets.paid_by || []);
    // Szűrő datalist-ek
    fillDatalist("filterTitlesList", sets.titles);
    fillDatalist("filterCategoriesList", sets.categories);
    fillDatalist("filterPaymentsList", sets.payments);
    fillDatalist("filterTypesList", sets.types);
}
function fillDatalist(listId, values) {
    const dl = document.getElementById(listId);
    if (!dl) return;
    dl.innerHTML = "";
    values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
    });
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
const toIsoDate = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const m1 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
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
function parseHuNumber(v) {
    const s = String(v ?? "")
        .trim()
        .replace(/\s+/g, "")     // hármas tagolás szóközei
        .replace(/ft/ig, "")     // ha esetleg belekerülne
        .replace(",", ".");      // tizedes vessző támogatás
    return Number(s);
}
function formatHuInteger(v) {
    const n = Math.abs(Number(v) || 0);
    return n.toLocaleString("hu-HU"); // pl. 2000 -> "2 000"
}
// ===== Shared Expenses – Row click opens modal for edit (no Edit button) =====
document.getElementById("sharedExpensesBody").addEventListener("click", (e) => {
    // Ha inputra kattint, akkor NE nyissunk modalt (maradjon az inline módosítás)
    if (e.target.closest("input, select, textarea, button")) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const rowId = tr.getAttribute("data-id");
    if (!rowId) return;
    const row = seRowsById.get(String(rowId));
    if (!row) return;
    // törlesztés felismerés ugyanazzal a logikával, mint rendernél
    const isSettlement = String(row.title || "").trim().toLowerCase().includes("törleszt");
    // modal megnyitása (resetel, beállítja a settlement UI-t)
    openSeModal(isSettlement);
    // szerkesztési mód jelölése (a későbbi mentés-logikához)
    const form = document.getElementById("seForm");
    if (form) form.setAttribute("data-edit-id", String(rowId));
    // mezők kitöltése
    const dateOnly = toInputDateLocal(row.date);
    document.getElementById("seDate").value = dateOnly || "";
    document.getElementById("seMonth").value = row.month || (dateOnly ? deriveMonth(dateOnly) : "");
    document.getElementById("seTitle").value = row.title || "";
    document.getElementById("seAmount").value = Math.abs(Number(row.amount) || 0);
    document.getElementById("sePaidBy").value = row.paid_by || "";
    // bontás mezők (törlesztésnél úgyis rejtve vannak, de értéket adhatunk)
    {
        const zVal = Number(row.Zsolti_amount);
        const dVal = Number(row.Dori_amount);
        document.getElementById("seZsoltiAmount").value =
            (!zVal || zVal === 0) ? "" : Math.abs(zVal);
        document.getElementById("seDoriAmount").value =
            (!dVal || dVal === 0) ? "" : Math.abs(dVal);
    }
    document.getElementById("seNotes").value = row.notes || "";
    // modal cím felülírása szerkesztésre
    const titleEl = document.getElementById("seModalTitle");
    if (titleEl) titleEl.textContent = isSettlement ? "Törlesztés szerkesztése" : "Megosztott tétel szerkesztése";
});
// ===== Shared Expenses – Event Delegation =====
document.getElementById("sharedExpensesBody").addEventListener("change", async (e) => {
    const target = e.target;
    const rowId = target?.getAttribute("data-id") || "";
    // --- CSAK a szám mezők (Zsolti/Dóri része) formázása ezres tagolással ---
    // Ne formázzunk title/paid_by/notes mezőt, mert abból "0" lesz (Number("") -> 0).
    if (
        target &&
        target.tagName === "INPUT" &&
        (target.classList.contains("se-zsolti-amount") || target.classList.contains("se-dori-amount"))
    ) {
        const raw = String(target.value ?? "");
        const cleaned = raw.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
        const asNumber = Number(cleaned.replace(",", "."));
        if (!isNaN(asNumber)) {
            target.value = formatAmount(asNumber);
        }
    }
    // Ha nincs sor azonosító (pl. inline új sor), akkor az updateSharedExpense ágakat kihagyjuk
    // (ettől még a Mentés/Mégse gombok működnek a saját click handlerükben)
    if (!rowId) {
        // Itt NE returnölj, ha a lentebb lévő gombokra (save-settlement stb.) támaszkodsz a change-ben.
        // Ha nálad a save/cancel gombok click eseménnyel mennek, akkor maradhat return.
    }
    if (!rowId) return;
    // 1) paid_by mező
    if (target.classList.contains("se-paid-by-input")) {
        const value = target.value.trim();
        if (!value) return;
        await api.updateSharedExpense(rowId, "paid_by", value);
        // value set frissítés, ha új elem
        const valueSets = await api.getValueSets();
        const existing = valueSets.sets.paid_by.map(v => v.toLowerCase());
        if (!existing.includes(value.toLowerCase())) {
            await api.addValueToSet("paid_by", value);
        }
        await loadSharedExpenses();
        return;
    }
    // 2) Zsolti_amount mező
    if (target.classList.contains("se-zsolti-amount")) {
        let value = target.value;
        if (value === "" || value === null) {
            alert("A Zsolti része mező kötelező (0 is érvényes érték).");
            target.focus();
            return;
        }
        value = Number(String(value).replace(/\s+/g, "").replace(",", "."));
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Zsolti része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }
        const resp = await api.updateSharedExpense(rowId, "Zsolti_amount", value);
        if (!resp || !resp.success) {
            alert(resp?.error || "Nem sikerült menteni a módosítást.");
            return;
        }
        await loadSharedExpenses();
        return;
    }
    // 3) Dori_amount mező
    if (target.classList.contains("se-dori-amount")) {
        let value = target.value;
        if (value === "" || value === null) {
            alert("A Dóri része mező kötelező (0 is érvényes érték).");
            target.focus();
            return;
        }
        value = Number(String(value).replace(/\s+/g, "").replace(",", "."));
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Dóri része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }
        const resp = await api.updateSharedExpense(rowId, "Dori_amount", value);
        if (!resp || !resp.success) {
            alert(resp?.error || "Nem sikerült menteni a módosítást.");
            return;
        }
        await loadSharedExpenses();
    }
    // ================================
    // INLINE TÖRLESZTÉS MENTÉSE
    // ================================
    if (e.target.classList.contains("save-settlement")) {
        await saveInlineSettlement();
        return;
    }
    // ================================
    // INLINE TÖRLESZTÉS MÉGSE
    // ================================
    if (e.target.classList.contains("cancel-settlement")) {
        const row = document.querySelector(".new-settlement-row");
        if (row) row.remove();
        return;
    }
});
// ===== Shared Expenses – Live recalculation while typing (no save) =====
document.getElementById("sharedExpensesBody").addEventListener("input", (e) => {
    const target = e.target;
    // csak a két "saját rész" mezőre
    if (!target.classList.contains("se-zsolti-amount") && !target.classList.contains("se-dori-amount")) {
        return;
    }
    const tr = target.closest("tr");
    if (!tr) return;
    // amount a 4. oszlopban (index 3) van: "12 345 Ft"
    const amountText = (tr.children[3]?.textContent || "").replace(/\s/g, "");
    const amount = Math.abs(Number(amountText.replace("Ft", "").replace(",", ".")) || 0);
    // paid_by az 5. oszlopban (index 4)
    const paidBy = (tr.children[4]?.textContent || "").trim().toLowerCase();
    const zInput = tr.querySelector(".se-zsolti-amount");
    const dInput = tr.querySelector(".se-dori-amount");
    // gépelés közben üres lehet: ilyenkor 0-val számolunk csak preview-hoz
    const z = Math.abs(Number((zInput?.value ?? "").toString().replace(/\s+/g, "").replace(",", ".")) || 0);
    const d = Math.abs(Number((dInput?.value ?? "").toString().replace(/\s+/g, "").replace(",", ".")) || 0);
    const remaining = amount - d - z;
    const halfRemaining = remaining / 2;
    const zsoltiBal = halfRemaining + z;
    const doriBal = halfRemaining + d;
    // DOM frissítések
    const remCell = tr.querySelector(".se-remaining");
    const zbCell = tr.querySelector(".se-zsolti-balance");
    const dbCell = tr.querySelector(".se-dori-balance");
    const bCell = tr.querySelector(".se-balance");
    if (remCell) remCell.textContent = formatAmount(remaining);
    if (zbCell) zbCell.textContent = formatAmount(zsoltiBal);
    if (dbCell) dbCell.textContent = formatAmount(doriBal);
    // Egyenleg oszlop: paid_by szerint (ugyanaz a logika, mint backendben)
    if (bCell) {
        let impact = "";
        if (paidBy === "dóri" || paidBy === "dori") impact = zsoltiBal;
        else if (paidBy === "zsolti") impact = doriBal;
        bCell.textContent = formatAmount(impact);
    }
});
function createInlineSharedExpenseRow() {
    const tbody = document.getElementById("sharedExpensesBody");
    // új sor létrehozása, ami a táblázat tetejére kerül
    const tr = document.createElement("tr");
    tr.classList.add("new-shared-row");
    tr.innerHTML = `
        <td><input type="date" class="se-new-date"></td>
        <td><input list="titlesList" class="se-new-title" placeholder="Megnevezés"></td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-amount"
                placeholder="Összeg"
            >
        </td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-zsoltiamount"
                placeholder="Zsolti része"
            >
        </td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-doriamount"
                placeholder="Dóri része"
            >
        </td>
        <td>
            <input 
                type="text"
                class="se-new-notes"
                placeholder="Megjegyzés"
            >
        </td>
        <td>
            <input class="se-new-paidby" list="paidByList" value="Zsolti">
        </td>
        <td>
            <button class="btn-primary se-save-new">Mentés</button>
            <button class="btn-secondary se-cancel-new">Mégse</button>
        </td>
    `;
    // beszúrjuk a táblázat elejére
    tbody.prepend(tr);
    // események
    tr.querySelector(".se-cancel-new").addEventListener("click", () => tr.remove());
    tr.querySelector(".se-save-new").addEventListener("click", saveNewSharedExpense);
}
async function saveNewSharedExpense() {
    const tr = document.querySelector(".new-shared-row");
    if (!tr) return;
    const date = tr.querySelector(".se-new-date").value;
    const title = tr.querySelector(".se-new-title").value.trim();
    const amount = Math.abs(Number(tr.querySelector(".se-new-amount").value));
    const paidBy = (tr.querySelector(".se-new-paidby")?.value || tr.querySelector(".se-new-paidby")?.textContent || "Zsolti").trim();
    const zsoltiAmount = Math.abs(Number(tr.querySelector(".se-new-zsoltiamount").value || 0));
    const doriAmount = Math.abs(Number(tr.querySelector(".se-new-doriamount").value || 0));
    const notes = (tr.querySelector(".se-new-notes")?.value || "").trim();
    if (!date || !title || isNaN(amount)) {
        alert("Dátum, megnevezés és összeg kötelező.");
        return;
    }
    // Hónap minden esetben a dátumból képződik (YYYYMM)
    const month = deriveMonth(date);
    const response = await api.addSharedExpense({
        month,
        date,
        title,                 // ne legyen fix "Törlesztés"
        amount,
        paid_by: paidBy,
        Zsolti_amount: zsoltiAmount,  // <-- ezt küldjük, ne 0-t
        Dori_amount: doriAmount,      // <-- ezt küldjük, ne 0-t
        notes
    });
    if (!response || !response.success) {
        console.error("addSharedExpense FAILED:", response);
        alert(response?.error || response?.message || "Hiba az új megosztott költség mentésekor.");
        return;
    }
    // inline sor eltávolítása és lista frissítése
    tr.remove();
    await loadSharedExpenses();
}
function createInlineSettlementRow() {
    const tbody = document.getElementById("sharedExpensesBody");
    if (!tbody) return;
    // Egyszerre csak egy új törlesztés sor lehessen
    if (document.querySelector(".new-settlement-row")) return;
    const tr = document.createElement("tr");
    tr.classList.add("new-settlement-row");
    tr.innerHTML = `
        <td></td>
        <td>
            <input type="date" class="set-date">
        </td>
        <td>
            <input type="text" class="set-title" value="Törlesztés" list="titlesList">
        </td>
        <td>
            <input type="number" class="set-amount" inputmode="decimal" step="any" placeholder="Összeg">
        </td>
        <td>
            <input class="set-paidby" list="paidByList" value="Zsolti">
        </td>
        <!-- Megosztott mezők: törlesztésnél nem releváns -> elrejtjük -->
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <!-- Egyenleg (lila) -->
        <td class="balance-settlement set-balance-preview">0</td>
        <!-- Megjegyzés + gombok -->
        <td>
            <input type="text" class="set-notes" placeholder="Megjegyzés" style="margin-bottom:10px;">
            <div class="settlement-actions">
                <button type="button" class="btn-primary save-settlement">Mentés</button>
                <button type="button" class="btn-secondary cancel-settlement">Mégse</button>
            </div>
        </td>
    `;
    tbody.prepend(tr);
    // Élő előnézet az Egyenleg cellában
    const amountInput = tr.querySelector(".set-amount");
    const previewCell = tr.querySelector(".set-balance-preview");
    amountInput.addEventListener("input", () => {
        const n = Math.abs(Number(amountInput.value) || 0);
        previewCell.textContent = formatAmount(n);
    });
    tr.querySelector(".cancel-settlement").addEventListener("click", () => tr.remove());
    tr.querySelector(".save-settlement").addEventListener("click", saveInlineSettlement);
}
async function saveInlineSettlement() {
    const tr = document.querySelector(".new-settlement-row");
    if (!tr) return;
    const date = tr.querySelector(".set-date").value;
    const title = (tr.querySelector(".set-title").value || "Törlesztés").trim();
    const amount = Math.abs(Number(tr.querySelector(".set-amount").value));
    const paidBy = (tr.querySelector(".set-paidby").value || "").trim();
    const notes = (tr.querySelector(".set-notes").value || "").trim();
    if (!date || !title || !amount || isNaN(amount)) {
        alert("Dátum, megnevezés és összeg kötelező.");
        return;
    }
    if (!paidBy) {
        alert("A 'Fizette' mező kötelező.");
        return;
    }
    const month = deriveMonth(date);
    // Settlement jelző + megosztott mezők nullázása
    const response = await api.addSharedExpense({
        month,
        date,
        title: title || "Törlesztés",
        amount,
        paid_by: paidBy,
        Zsolti_amount: 0,
        Dori_amount: 0,
        settlement: "x",   // <-- ettől lesz speciális számítás a backendben
        notes
    });
    if (!response || !response.success) {
        console.error("addSharedExpense (settlement) FAILED:", response);
        alert(response?.error || response?.message || "Hiba történt a törlesztés mentésekor.");
        return;
    }
    tr.remove();
    await loadSharedExpenses();
}

