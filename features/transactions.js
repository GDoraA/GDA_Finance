document.addEventListener("page:transactions", () => {
    txCurrentPage = 1;
    loadTransactions();
});
let bankTxCache = null;
let bankTxCachePromise = null;
let bankToTxMap = new Map();
let filteredTransactions = [];
let transactionsCache = null;
async function ensureTransactionsCache(forceRefresh = false) {
    if (!forceRefresh && Array.isArray(transactionsCache)) return transactionsCache;
    try {
        const r = await api.getTransactions();
        transactionsCache = (r && r.success && Array.isArray(r.data)) ? r.data : [];
        bankToTxMap.clear();

        transactionsCache.forEach(t => {
            const bankIds = String(t.statement_item || "")
                .split(",")
                .map(s => s.trim())
                .filter(Boolean);
            bankIds.forEach(id => {
                if (!bankToTxMap.has(id)) bankToTxMap.set(id, []);
                bankToTxMap.get(id).push(t.id);
            });
        });
    } catch (_) {
        transactionsCache = [];
    }
    return transactionsCache;
}
async function ensureBankTxCache() {
    if (bankTxCache) return bankTxCache;
    if (bankTxCachePromise) return bankTxCachePromise;

    bankTxCachePromise = (async () => {
        const resp = await api.getBankTransactions();
        const items = (resp && resp.success && Array.isArray(resp.data)) ? resp.data : [];
        bankTxCache = items;
        bankTxCachePromise = null;
        return bankTxCache;
    })();
    return bankTxCachePromise;
}
function getMatchingBankItems(tx, bankItems) {
    const rawTxDate = String(tx?.date ?? "").trim();
    const txDateIso = rawTxDate.includes("T") ? rawTxDate.split("T")[0] : toInputDateLocal(rawTxDate);
    const txAmt = Number(tx?.amount);
    return (bankItems || []).filter(b => {
        const bDateIso = String(b?.transaction_date ?? "").trim();
        const bAmt = Number(b?.amount);
        if (!txDateIso || !bDateIso) return false;
        if (Number.isNaN(txAmt) || Number.isNaN(bAmt)) return false;
        // előjel kezelése: abs összehasonlítás
        return (bDateIso === txDateIso) && (Math.abs(bAmt) === Math.abs(txAmt));
    });
}
async function loadTransactions(forceRefresh = false) {
    // ===== SORT ICONS RESET (TRANSACTIONS) =====
    document.querySelectorAll("#transactionsTable thead th[data-sort]").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.getAttribute("data-sort") === txSortField) {
            th.classList.add(txSortDirection === "asc" ? "sort-asc" : "sort-desc");
        }
    });
    const tbody = document.getElementById("transactionsBody");
    const data = await ensureTransactionsCache(forceRefresh);
    if (!Array.isArray(data)) {
        console.error("Nem sikerült betölteni a tranzakciókat.");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9">Nincs jogosultság vagy hiba: ismeretlen</td></tr>`;
        }
        return;
    }
    transactionsCache = Array.isArray(data) ? data : [];
    // --- Szűrőmezők ---
    const fMonth = document.getElementById("filterMonth").value.trim();
    const fDate = document.getElementById("filterDate").value.trim();
    const fAmount = document.getElementById("filterAmount").value.trim();
    const fTitle = document.getElementById("filterTitle").value.trim().toLowerCase();
    const fCategory = document.getElementById("filterCategory").value.trim().toLowerCase();
    const fType = document.getElementById("filterType").value.trim().toLowerCase();
    const fPayment = document.getElementById("filterPaymentType").value.trim().toLowerCase();
    const fShared = document.getElementById("filterShared").value;
    const fStatement = document.getElementById("filterStatement").value.trim().toLowerCase();
    const fUnmatched = document.getElementById("filterUnmatched")?.checked === true;
    // --- Szűrés ---
    filteredTransactions = data.filter(tx => {
        if (fMonth && String(tx.month) !== fMonth) return false;
        if (fDate) {
            const txDateFmt = formatDateForList(tx.date);
            if (txDateFmt !== formatDateForList(fDate)) {
                return false;
            }
        }
        // Összeg szűrés: támogatja a >1000 vagy <5000 formátumot
        if (fAmount) {
            const txAmtAbs = Math.abs(Number(tx.amount));
            if (fAmount.startsWith(">")) {
                const min = Number(fAmount.substring(1));
                if (!(txAmtAbs > min)) return false;
            } else if (fAmount.startsWith("<")) {
                const max = Number(fAmount.substring(1));
                if (!(txAmtAbs < max)) return false;
            } else {
                if (String(txAmtAbs) !== fAmount) return false;
            }
        }
        if (fTitle && !String(tx.title).toLowerCase().includes(fTitle)) return false;
        if (fCategory && !String(tx.category).toLowerCase().includes(fCategory)) return false;
        if (fPayment && !String(tx.payment_type).toLowerCase().includes(fPayment)) return false;
        if (fType && String(tx.transaction_type || "").trim().toLowerCase() !== fType) return false;
        // Megosztott? szűrés javítása
        if (fShared) {
            // backend: "x" = megosztott, "" = nem megosztott
            const sharedValue = tx.is_shared === "x" ? "x" : "0";
            if (sharedValue !== fShared) return false;
        }
        if (fUnmatched && String(tx?.statement_item ?? "").trim() !== "") return false;
        if (fStatement && !String(tx.statement_item).toLowerCase().includes(fStatement)) return false;
        return true;
    });
    // ===== ÚJ: RENDEZÉS (a lapozás előtt, a filtered teljes halmazon) =====
    if (txSortField) {
        const dir = (txSortDirection === "asc") ? 1 : -1;
        const toNum = (v) => {
            // támogatja: 1234, "1 234", "1 234,56"
            const n = Number(String(v).replace(/\s+/g, "").replace(",", "."));
            return isNaN(n) ? null : n;
        };
        const toTime = (v) => {
            const t = new Date(v).getTime();
            return isNaN(t) ? null : t;
        };
        filteredTransactions.sort((a, b) => {
            const va = a[txSortField];
            const vb = b[txSortField];
            // null/undefined a végére
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            switch (txSortField) {
                case "amount": {
                    const na = toNum(va);
                    const nb = toNum(vb);
                    if (na == null && nb == null) return 0;
                    if (na == null) return 1;
                    if (nb == null) return -1;
                    return (na - nb) * dir;
                }
                case "month": {
                    const na = Number(va);
                    const nb = Number(vb);
                    if (isNaN(na) && isNaN(nb)) return 0;
                    if (isNaN(na)) return 1;
                    if (isNaN(nb)) return -1;
                    return (na - nb) * dir;
                }
                case "date": {
                    const ta = toTime(va);
                    const tb = toTime(vb);
                    if (ta == null && tb == null) return 0;
                    if (ta == null) return 1;
                    if (tb == null) return -1;
                    return (ta - tb) * dir;
                }
                case "is_shared": {
                    const ba = (va === "x") ? 1 : 0;
                    const bb = (vb === "x") ? 1 : 0;
                    return (ba - bb) * dir;
                }
                default: {
                    // title/category/payment_type/transaction_type/statement_item
                    const sa = String(va).toLowerCase();
                    const sb = String(vb).toLowerCase();
                    return sa.localeCompare(sb, "hu") * dir;
                }
            }
        });
    }
    // ===== Találatok kijelző elemek (csak referencia) =====
    const rcTop = document.getElementById("transactions-result-count");
    const rcBottom = document.getElementById("transactions-result-count-bottom");
    // ===== Egyenlegek számítása típus alapján =====
    let expenseTotal = 0;
    let incomeTotal = 0;
    let savingTotal = 0;
    (data || []).forEach(tx => {
        const t = String(tx.transaction_type || "").trim().toLowerCase();
        const amount = Number(tx.amount) || 0;
        const isSaving = t.includes("megtak") || t === "saving";
        const isExpense = t.includes("kiad") || t === "expense";
        const isIncome = t.includes("bev") || t === "income";
        if (isSaving) {
            savingTotal += amount;
        } else if (isExpense) {
            expenseTotal += amount;
        } else if (isIncome) {
            incomeTotal += amount;
        }
    });
    // ===== Egyenlegek kiírása (index.html ID-k alapján) =====
    const be = document.getElementById("txExpenseTotal");
    const bi = document.getElementById("txIncomeTotal");
    const bs = document.getElementById("txSavingTotal");
    if (be) be.textContent = `${formatAmount(expenseTotal)} Ft`;
    if (bi) bi.textContent = `${formatAmount(incomeTotal)} Ft`;
    if (bs) bs.textContent = `${formatAmount(savingTotal)} Ft`;
    // ===== Nettó egyenleg: Bevétel - Kiadás =====
    const netBalance = incomeTotal - Math.abs(expenseTotal);
    const nb = document.getElementById("txNetBalance");
    if (nb) {
        const signClass = netBalance < 0 ? "amount-expense" : "amount-income";
        nb.className = signClass;
        nb.textContent = `${formatSignedAmount(netBalance)} Ft`;
    }
    // --- Kiírás ---
    if (filteredTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">Nincs megjeleníthető adat.</td></tr>`;
        return;
    }
    // --- Elemszám kezelése (itemsPerPage) – közös helperrel ---
    const paginationBox = document.getElementById("transactions-pagination");
    const itemsPerPageSelect = document.getElementById("itemsPerPage");
    const itemsPerPageValue = itemsPerPageSelect ? itemsPerPageSelect.value : "all";
    const pageSize = readPageSize("itemsPerPage", filteredTransactions.length, 100);
    const meta = getPaginationMeta(filteredTransactions.length, pageSize, txCurrentPage);
    txCurrentPage = meta.page;
    let visibleItems = filteredTransactions;
    if (itemsPerPageValue !== "all") {
        if (paginationBox) paginationBox.style.display = "flex";
        visibleItems = filteredTransactions.slice(meta.start, meta.end);
        updatePaginationUI(
            {
                pageInfoId: "txPageInfo",
                resultCountId: null,
                firstBtnId: "txFirstPageBtn",
                prevBtnId: "txPrevPageBtn",
                nextBtnId: "txNextPageBtn",
                lastBtnId: "txLastPageBtn"
            },
            meta.page,
            meta.totalPages,
            visibleItems.length,
            filteredTransactions.length
        );
    } else {
        // Összes elem esetén nincs lapozás
        txCurrentPage = 1;
        if (paginationBox) paginationBox.style.display = "none";
    }
    // ===== Találatok: megjelenített / összes =====
    const txt = `Találatok: ${visibleItems.length} / ${filteredTransactions.length} db`;
    if (rcTop) rcTop.textContent = txt;
    if (rcBottom) rcBottom.textContent = txt;
    let rows = "";
    visibleItems.forEach(tx => {
        rows += `
                <tr data-id="${tx.id}" class="${(tx.statement_item && String(tx.statement_item).trim() !== "") ? "is-matched" : ""}">
                    <td>${tx.month}</td>
                    <td>${formatDateForList(tx.date)}</td>
                    <td class="${(() => {
                const t = String(tx.transaction_type || "").trim().toLowerCase();
                const isSaving = t.includes("megtak") || t === "saving";
                const isExpense = t.includes("kiad") || t === "expense" || (Number(tx.amount) < 0);
                const isIncome = t.includes("bev") || t === "income" || (Number(tx.amount) > 0);
                if (isSaving) return "amount-saving";
                if (isExpense) return "amount-expense";
                if (isIncome) return "amount-income";
                return "";
            })()
            }">
                        ${formatAmount(tx.amount)}
                    </td>
                    <td>${tx.title}</td>
                    <td>${tx.category}</td>
                    <td>${tx.payment_type}</td>
                    <td>${tx.transaction_type}</td>
                    <td>
                        <input type="checkbox" disabled ${tx.is_shared === "x" ? "checked" : ""}>
                    </td>
<td>${parseStatementItemIds(tx.statement_item)
                .map(id => `#${id}`)
                .join(" · ")
            }</td>
                </tr>
            `;
    });
    tbody.innerHTML = rows;
    // ===== STATEMENT ITEM SELECTEK FELTÖLTÉSE (Bank_Transactions alapján) =====
    try {
        const bankItems = await ensureBankTxCache();
        visibleItems.forEach(tx => {
            const sel = document.getElementById(`stmt_${String(tx?.id ?? "").trim()}`);
            if (!sel) return;
            sel.innerHTML = buildStatementItemOptions(tx, bankItems);
            const current = String(tx?.statement_item ?? "").trim();
            if (current) sel.value = current;
            // Ne nyissa meg a szerkesztő modalt, ha a dropdownra kattintasz
            sel.addEventListener("click", (e) => e.stopPropagation());
            sel.addEventListener("change", async (e) => {
                e.stopPropagation();
                const txId = String(sel.dataset.txId || "").trim();
                const newValue = String(sel.value || "").trim();
                if (!txId) return;
                // TELJES SOR KÜLDÉSE, hogy backend ne nullázza a hiányzó mezőket
                const safeDate = String(tx?.date ?? "").includes("T") ? String(tx.date).split("T")[0] : String(tx?.date ?? "").trim();
                const payload = {
                    id: txId,
                    month: String(tx?.month ?? "").trim(),
                    date: safeDate,
                    amount: String(tx?.amount ?? ""),                 // már signed érték a listában
                    title: String(tx?.title ?? "").trim(),
                    category: String(tx?.category ?? "").trim(),
                    payment_type: String(tx?.payment_type ?? "").trim(),
                    transaction_type: String(tx?.transaction_type ?? "").trim(),
                    is_shared: (tx?.is_shared === "x" || tx?.is_shared === true || tx?.is_shared === "true") ? "x" : "",
                    statement_item: newValue
                };
                const resp = await api.updateTransaction(payload);
                if (resp && resp.success) {
                    // frontenden is frissítsük a memóriában, hogy ne villanjon vissza
                    tx.statement_item = newValue;
                } else {
                    alert(resp?.error || resp?.message || "Nem sikerült menteni a banki tétel összerendelést.");
                }
            });
        });
    } catch (e) {
        console.error("statement_item select hydrate hiba:", e);
    }
    // ===== TABLÁZAT SORAINAK KATTINTÁSA – SZERKESZTÉS =====
    const rowsElements = document.querySelectorAll("#transactionsBody tr");
    rowsElements.forEach(row => {
        row.addEventListener("click", () => {
            const id = row.getAttribute("data-id");
            // A teljes rekordot megkeressük a betöltött adatok között
            const tx = data.find(item => String(item.id) === String(id));
            if (tx) {
                openTransactionEditor(tx);
            }
        });
    });
}
document.getElementById("loadListBtn")?.addEventListener("click", () => {
    txCurrentPage = 1;
    loadTransactions();
});
// ===== TRANSACTIONS – FEJLÉCRE KATTINTVA RENDEZÉS =====
document.querySelectorAll("#transactionsTable thead th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;

        if (txSortField === field) {
            txSortDirection = (txSortDirection === "asc") ? "desc" : "asc";
        } else {
            txSortField = field;
            txSortDirection = "asc";
        }

        txCurrentPage = 1;
        loadTransactions();
    });
});


const filtersPanel = document.getElementById("filtersPanel");
const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
toggleFiltersBtn?.addEventListener("click", () => {
    filtersPanel?.classList.toggle("open");
});
const filterFields = [
    "filterMonth", "filterDate", "filterAmount", "filterTitle",
    "filterCategory", "filterPaymentType", "filterType",
    "filterShared", "filterStatement", "filterUnmatched"
].map(id => document.getElementById(id)).filter(Boolean);
function updateFilterPanelState() {
    const hasFilters = filterFields.some(el => {
        if (!el) return false;
        if (el.type === "checkbox") return el.checked === true;
        return String(el.value ?? "").trim() !== "";
    });
    if (hasFilters) {
        filtersPanel.classList.add("open");
    } else {
        filtersPanel.classList.remove("open");
    }
}
// Minden szűrőmező változásakor:
// 1) frissítjük a panel nyitott/zárt állapotát
// 2) újratöltjük a listát az aktuális szűrőfeltételekkel
filterFields.forEach(el => {
    el.addEventListener("input", () => {
        updateFilterPanelState();
        txCurrentPage = 1;
        loadTransactions();
    });
});
document.getElementById("itemsPerPage")?.addEventListener("change", (e) => {
    itemsPerPage = Number(e.target.value) || 10;
    txCurrentPage = 1;
    loadTransactions();
});
// ===== SZŰRŐK TÖRLÉSE =====
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    const fields = [
        "filterMonth", "filterDate", "filterAmount", "filterTitle",
        "filterCategory", "filterPaymentType", "filterType",
        "filterShared", "filterStatement", "filterUnmatched"
    ];
    // mezők kiürítése
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === "checkbox") el.checked = false;
            else el.value = "";
        }
    });
    // szűrőpanel bezárása
    const filtersPanel = document.getElementById("filtersPanel");
    filtersPanel.classList.remove("open");
    // teljes lista újratöltése
    txCurrentPage = 1;
loadTransactions();
});
// Lapozó gombok: egyszeri eseménykezelők (NEM loadTransactions-ben!)
document.getElementById("txFirstPageBtn")?.addEventListener("click", () => {
    txCurrentPage = 1;
    loadTransactions();
});
document.getElementById("txPrevPageBtn")?.addEventListener("click", () => {
    if (txCurrentPage > 1) {
        txCurrentPage -= 1;   // garantáltan +/-1
        loadTransactions();
    }
});
document.getElementById("txNextPageBtn")?.addEventListener("click", () => {
    txCurrentPage += 1;       // a felső korlátot loadTransactions vágja vissza
    loadTransactions();
});
document.getElementById("txLastPageBtn")?.addEventListener("click", () => {
    // Utolsó oldalra ugrás: a legegyszerűbb és stabil megoldás,
    // hogy "túl nagyra" tesszük, a loadTransactions pedig visszavágja totalPages-re.
    txCurrentPage = 999999;
    loadTransactions();
});
// ===== Mentés =====
document.getElementById("txForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const formData = Object.fromEntries(form.entries());
    console.log("TX FORM SUBMIT RAW (BEFORE NORMALIZE):", formData);
    // Ha valamiért üres maradt a month, számoljuk a date-ből
    if (!formData.month && formData.date) {
        formData.month = deriveMonth(formData.date);
    }
    // Megosztott checkbox → "x" / ""
    const isSharedCheckbox = document.querySelector("#txForm input[name='is_shared']");
    formData.is_shared = (isSharedCheckbox && isSharedCheckbox.checked) ? "x" : "";
    // ===== ÖSSZEG NORMALIZÁLÁS =====
    // UI: a felhasználó mindig pozitív összeget ír be
    // Mentés: expense -> negatív, income -> pozitív
    const normalizeSignedAmount = (raw, txType) => {
        const str = String(raw ?? "").trim();
        if (!str) return "";
        // támogatja: "1 234", "1 234,56"
        const n = Number(str.replace(/\s+/g, "").replace(",", "."));
        if (isNaN(n)) return str; // ha valamiért nem szám, hagyjuk változatlanul
        const abs = Math.abs(n);
        const signed = (txType === "Kiadás") ? -abs : abs;
        return String(signed);
    };
    formData.amount = normalizeSignedAmount(formData.amount, formData.transaction_type);
    console.log("TX FORM SUBMIT (AFTER NORMALIZE):", formData);
    // ===== ÜTKÖZÉS ELLENŐRZÉS (több banki ID esetén is) =====
    // Egy banki tétel nem lehet több tranzakcióhoz rendelve.
    // statement_item formátum: "12, 18, 25"
    const editIdNow = e.target.getAttribute("data-edit-id"); // lehet null
    const selectedBankIds = parseStatementItemIds(formData.statement_item);
    // duplikált kiválasztás ugyanazon mezőn belül se legyen
    const dedup = Array.from(new Set(selectedBankIds));
    if (dedup.length !== selectedBankIds.length) {
        alert("Ugyanaz a banki tétel többször van kiválasztva. Kérlek javítsd.");
        return;
    }
    // ha nincs cache, próbáljuk frissíteni
    if (!Array.isArray(transactionsCache)) {
        try {
            const r = await api.getTransactions();
            transactionsCache = (r && r.success && Array.isArray(r.data)) ? r.data : [];
        } catch (_) {
            transactionsCache = [];
        }
    }
    // ellenőrzés: bármely kiválasztott bankId szerepel-e másik tranzakció statement_item listájában
    const conflict = (transactionsCache || []).find(t => {
        const tid = String(t?.id ?? "");
        if (editIdNow && tid === String(editIdNow)) return false; // saját rekordot engedjük
        const ids = String(t?.statement_item ?? "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);
        return ids.some(id => dedup.includes(id));
    });
    if (conflict) {
        alert("Hiba: a kiválasztott banki tétel már hozzá van rendelve egy másik tranzakcióhoz.");
        return; // mentés leáll
    }
    // normalizáljuk a mentendő formátumot: "id1, id2, id3"
    formData.statement_item = dedup.join(", ");
    // Dátum mentési formátumra konvertálása
    // Dátumot ISO formátumban kell küldeni → yyyy-mm-dd maradjon
    // formData.date változatlanul marad
    const s = document.getElementById("successMsg");
    const er = document.getElementById("errorMsg");
    s.style.display = "none";
    er.style.display = "none";
    // Ha van edit ID, akkor módosítunk – ha nincs, új rekord jön létre
    const editId = e.target.getAttribute("data-edit-id");
    console.log("EDIT MODE?", { editId });
    let result;
    try {
        if (editId) {
            // ===== MÓDOSÍTÁS =====
            formData.id = editId;
            console.log("FORMDATA OBJECT CONTENTS:", JSON.stringify(formData, null, 2));
            console.log("CALL updateTransaction WITH:", formData);
            result = await api.updateTransaction(formData);
            console.log("UPDATE RESULT RAW:", result);
            console.log("UPDATE SUCCESS:", result?.success);
            console.log("UPDATE MESSAGE:", result?.message);
        } else {
            // ===== ÚJ REKORD =====
            result = await api.addTransaction(formData);
        }
        console.log("API RESULT:", result);
        if (result && result.success) {
            s.style.display = "block";
            setTimeout(() => { s.style.display = "none"; }, 1500);
            // form ürítése
            e.target.reset();
            // szerkesztési mód kikapcsolása
            e.target.removeAttribute("data-edit-id");
            // datalist frissítése
            await loadDropdownValues();
            // modal bezárása
            modal.classList.remove("open");
            overlay.classList.remove("open");
            // lista frissítése
            await loadTransactions(true);
            await loadSharedExpenses();
        } else {
            er.style.display = "block";
            console.error("SAVE FAILED:", result);
            // Ha van hibaüzenet a backendből, azt is írjuk ki
            if (result?.error) {
                er.textContent = result.error;
            } else {
                er.textContent = "A mentés sikertelen (ismeretlen hiba).";
            }
        }
    } catch (err) {
        er.style.display = "block";
        console.error(err);
    }
});
// ===== BULK MATCH MODAL =====
const bulkMatchBtn = document.getElementById("bulkMatchBtn");
const bulkMatchModal = document.getElementById("bulkMatchModal");
const bulkMatchCancelBtn = document.getElementById("bulkMatchCancelBtn");
const bulkMatchSaveBtn = document.getElementById("bulkMatchSaveBtn");
const bulkMatchListEl = document.getElementById("bulkMatchList");
const closeBulkMatchModal = () => {
    if (bulkMatchModal) bulkMatchModal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
};
const buildBulkMatchRowHtml = (tx, bank) => {
    const esc = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const txId = String(tx?.id ?? "").trim();
    const txDate = formatDateForList(tx?.date);
    const txAmt = formatAmount(tx?.amount);
    const txTitle = String(tx?.title ?? "").trim();
    const txCat = String(tx?.category ?? "").trim();
    const bId = String(bank?.id ?? "").trim();
    const bDate = String(bank?.transaction_date ?? "").trim();
    const bAmt = formatAmount(bank?.amount);
    const bPartner = String(bank?.partner_name ?? "").trim();
    const bMemo = String(bank?.memo ?? "").trim();
    const left = [`#${txId}`, txDate, `${txAmt} Ft`, txTitle, txCat].filter(Boolean).join(" | ");
    const right = [`#${bId}`, bDate, `${bAmt} Ft`, bPartner, bMemo].filter(Boolean).join(" | ");
    return `
        <div class="bulk-match-row" data-tx-id="${esc(txId)}" data-bank-id="${esc(bId)}">
            <div class="col-left">${esc(left)}</div>
            <div class="col-right">${esc(right)}</div>
            <div class="col-check">
                <input type="checkbox" class="bulk-match-approve" checked>
            </div>
        </div>
    `;
};
async function renderBulkMatchList() {
    if (!bulkMatchListEl) return;
    // biztos legyen friss cache (ha valamiért még nem volt loadTransactions)
    if (!Array.isArray(transactionsCache)) {
        try {
            const r = await api.getTransactions();
            transactionsCache = (r && r.success && Array.isArray(r.data)) ? r.data : [];
        } catch (_) {
            transactionsCache = [];
        }
    }
    const bankItems = await ensureBankTxCache();
    // már használt banki tételek (statement_item alapján)
    // manuálisan lehet több ID: "12, 18, 25" -> itt mindet figyelembe kell venni,
    // hogy bulk-ban ne ajánljunk fel már foglalt banki tételt
    const usedBankIds = new Set(
        (transactionsCache || [])
            .flatMap(t => String(t?.statement_item ?? "")
                .split(",")
                .map(x => x.trim())
                .filter(Boolean)
            )
    );
    // csak nem párosított tranzakciók, amikhez van találat
    const candidates = (transactionsCache || [])
        .filter(tx => !String(tx?.statement_item ?? "").trim())
        .map(tx => {
            const matchesAll = getMatchingBankItems(tx, bankItems);
            // csak olyan banki találat, ami még nincs felhasználva
            const matchesFree = matchesAll.filter(b => {
                const bid = String(b?.id ?? "").trim();
                return bid && !usedBankIds.has(bid);
            });
            return { tx, matches: matchesFree };
        })
        .filter(x => x.matches.length > 0);
    if (candidates.length === 0) {
        bulkMatchListEl.innerHTML = `<div class="muted">— nincs megjeleníthető automatikus találat (dátum + összeg alapján) —</div>`;
        return;
    }
    // 1 tranzakció = 1 ajánlott banki tétel (első találat), default jóváhagyva (checked)
    bulkMatchListEl.innerHTML = candidates
        .map(x => buildBulkMatchRowHtml(x.tx, x.matches[0]))
        .join("");
}
if (bulkMatchBtn && bulkMatchModal && overlay) {
    bulkMatchBtn.addEventListener("click", async () => {
        // biztos ami biztos: a txModal ne maradjon nyitva
        if (modal) modal.classList.remove("open");
        try {
            await renderBulkMatchList();
        } catch (e) {
            console.error("Bulk match lista render hiba:", e);
            if (bulkMatchListEl) {
                bulkMatchListEl.innerHTML = `<div class="muted">Nem sikerült betölteni az automatikus találatokat.</div>`;
            }
        }
        bulkMatchModal.classList.add("open");
        overlay.classList.add("open");
    });
}
if (bulkMatchCancelBtn && bulkMatchModal && overlay) {
    bulkMatchCancelBtn.addEventListener("click", () => {
        closeBulkMatchModal();
    });
}
// Mentés: csak a bepipált sorokat menti (bulk backend action)
if (bulkMatchSaveBtn && bulkMatchModal && overlay) {
    bulkMatchSaveBtn.addEventListener("click", async () => {
        try {
            const rows = bulkMatchListEl
                ? Array.from(bulkMatchListEl.querySelectorAll(".bulk-match-row"))
                : [];
            const approved = rows.filter(r => {
                const cb = r.querySelector("input.bulk-match-approve");
                return cb && cb.checked;
            });
            if (approved.length === 0) {
                closeBulkMatchModal();
                return;
            }
            bulkMatchSaveBtn.disabled = true;
            const items = approved
                .map(r => {
                    const txId = String(r.getAttribute("data-tx-id") || "").trim();
                    const bankId = String(r.getAttribute("data-bank-id") || "").trim();
                    return (txId && bankId) ? { id: txId, statement_item: bankId } : null;
                })
                .filter(Boolean);
            if (items.length === 0) {
                closeBulkMatchModal();
                return;
            }
            // ===== HARD STOP: egy banki tétel nem lehet több tranzakcióhoz rendelve =====
            // (manuális checkboxos több-hozzárendelés miatt a statement_item lehet "12, 18")
            if (!Array.isArray(transactionsCache)) {
                try {
                    const r = await api.getTransactions();
                    transactionsCache = (r && r.success && Array.isArray(r.data)) ? r.data : [];
                } catch (_) {
                    transactionsCache = [];
                }
            }
            const usedByOtherTx = new Map(); // bankId -> txId
            (transactionsCache || []).forEach(t => {
                const txId = String(t?.id ?? "").trim();
                const ids = String(t?.statement_item ?? "")
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean);
                ids.forEach(id => {
                    if (!usedByOtherTx.has(id)) usedByOtherTx.set(id, txId);
                });
            });
            // ha bármely kiválasztott bankId már foglalt másik tx-ben, álljunk meg
            const conflict = items.find(it => {
                const bankId = String(it.statement_item ?? "").trim();
                const ownerTxId = usedByOtherTx.get(bankId);
                return ownerTxId && ownerTxId !== String(it.id);
            });
            if (conflict) {
                alert("Hiba: a kiválasztott banki tétel már hozzá van rendelve egy másik tranzakcióhoz. Bulk mentés leáll.");
                return;
            }
            // ===== UI státusz elem (ha nincs, létrehozzuk a modal tetején) =====
            const ensureBulkStatusEl = () => {
                let el = document.getElementById("bulkMatchStatus");
                if (!el && bulkMatchModal) {
                    const content = bulkMatchModal.querySelector(".modal-content");
                    if (content) {
                        el = document.createElement("div");
                        el.id = "bulkMatchStatus";
                        el.style.margin = "8px 0 12px 0";
                        el.style.padding = "8px";
                        el.style.border = "1px solid #ddd";
                        el.style.borderRadius = "8px";
                        el.style.fontSize = "0.9rem";
                        // h2 után szúrjuk be
                        const h2 = content.querySelector("h2");
                        if (h2 && h2.nextSibling) content.insertBefore(el, h2.nextSibling);
                        else content.insertBefore(el, content.firstChild);
                    }
                }
                return el;
            };
            const statusEl = ensureBulkStatusEl();
            const setStatus = (html) => {
                if (statusEl) statusEl.innerHTML = html;
            };
            // ===== Progress + összesítés =====
            const total = items.length;
            let processed = 0;
            let okTotal = 0;
            let failTotal = 0;
            const errorList = []; // {id, error}
            setStatus(`Mentés folyamatban… <strong>0 / ${total}</strong>`);
            // JSONP miatt az URL hossza limitált → daraboljuk a mentést kisebb csomagokra
            const CHUNK_SIZE = 50;
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                const chunk = items.slice(i, i + CHUNK_SIZE);
                setStatus(`Mentés folyamatban… <strong>${processed} / ${total}</strong> (csomag: ${Math.floor(i / CHUNK_SIZE) + 1})`);
                const resp = await api.bulkMatchTransactions(chunk);
                if (!resp || !resp.success) {
                    throw new Error(resp?.error || resp?.message || "Bulk mentés sikertelen (chunk).");
                }
                // backend aggregátumok
                okTotal += Number(resp.ok || 0);
                failTotal += Number(resp.fail || 0);
                // részletes hibák gyűjtése
                if (Array.isArray(resp.results)) {
                    resp.results.forEach(r => {
                        if (r && r.success === false) {
                            errorList.push({
                                id: String(r.id ?? ""),
                                error: String(r.error ?? "Ismeretlen hiba")
                            });
                        }
                    });
                }
                processed += chunk.length;
                setStatus(`Mentés folyamatban… <strong>${processed} / ${total}</strong>`);
            }
            // cache frissítés (helyben) – csak a sikeresen kért párokra
            for (const it of items) {
                const tx = (transactionsCache || []).find(t => String(t?.id ?? "").trim() === String(it.id));
                if (tx) tx.statement_item = String(it.statement_item);
            }
            // VÉGSŐ RIport a modalban (nem zárjuk be automatikusan, hogy lásd a státuszt)
            let reportHtml = `✅ Mentés kész. <strong>Sikeres:</strong> ${okTotal} / ${total}`;
            if (failTotal > 0) reportHtml += ` • <strong>Hibás:</strong> ${failTotal}`;

            if (errorList.length > 0) {
                const itemsHtml = errorList
                    .slice(0, 200) // ne legyen végtelen hosszú
                    .map(e => `<li><strong>${String(e.id || "—")}</strong>: ${String(e.error || "")}</li>`)
                    .join("");
                reportHtml += `
        <div style="margin-top:10px;">
            <div><strong>Hibák listája</strong> (max 200):</div>
            <ul style="max-height:180px; overflow:auto; margin:6px 0 0 18px; padding:0;">
                ${itemsHtml}
            </ul>
        </div>
    `;
            }
            setStatus(reportHtml);
            // Lista frissítés, hogy azonnal zöld/pipás legyen ahol kell
            await loadTransactions();
            // cache frissítés (helyben, majd listafrissítés)
            for (const it of items) {
                const tx = (transactionsCache || []).find(t => String(t?.id ?? "").trim() === String(it.id));
                if (tx) tx.statement_item = String(it.statement_item);
            }
            closeBulkMatchModal();
            await loadTransactions();
        } catch (e) {
            console.error("Bulk match mentés hiba:", e);
            alert(e?.message || "Hiba történt a csoportos párosítás mentésekor.");
        } finally {
            bulkMatchSaveBtn.disabled = false;
        }
    });
}