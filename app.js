document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.querySelector(".sidebar");
    const hamburger = document.getElementById("hamburgerBtn");

    hamburger.addEventListener("click", () => {
        // mobilon: toggle open / closed
        sidebar.classList.toggle("open");
    });

});
document.addEventListener("DOMContentLoaded", () => {

    // ===== MODAL =====
    const modal = document.getElementById("txModal");
    const overlay = document.getElementById("modalOverlay");
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");

    openBtn.addEventListener("click", () => {
        const form = document.getElementById("txForm");

        form.reset();
        form.removeAttribute("data-edit-id");

        modal.classList.add("open");
        overlay.classList.add("open");
    });

    closeBtn.addEventListener("click", () => {
        modal.classList.remove("open");
        overlay.classList.remove("open");
    });

    // ===== Dátum → hónap =====
    const dateInput = document.querySelector("input[name='date']");
    const monthInput = document.querySelector("input[name='month']");

    dateInput.addEventListener("change", () => {
        if (dateInput.value) {
            monthInput.value = deriveMonth(dateInput.value);
        }
    });

    // ===== Datalist betöltés =====
    loadDropdownValues();

    // ===== Mentés =====
    document.getElementById("txForm").addEventListener("submit", async e => {
        e.preventDefault();

        const form = new FormData(e.target);
        const formData = Object.fromEntries(form.entries());
        console.log("TX FORM SUBMIT RAW (BEFORE NORMALIZE):", formData);

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

                // form ürítése
                e.target.reset();

                // szerkesztési mód kikapcsolása
                e.target.removeAttribute("data-edit-id");

                // datalist frissítése
                loadDropdownValues();

                // modal bezárása
                modal.classList.remove("open");
                overlay.classList.remove("open");

                // lista frissítése
                loadTransactions();
                loadSharedExpenses(); 
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

    const filtersPanel = document.getElementById("filtersPanel");
    const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");

    // Gomb — manuális nyitás/zárás
    toggleFiltersBtn.addEventListener("click", () => {
        filtersPanel.classList.toggle("open");
    });
    const filterFields = [
        "filterMonth", "filterDate", "filterAmount", "filterTitle",
        "filterCategory", "filterPaymentType", "filterType",
        "filterShared", "filterStatement"
    ].map(id => document.getElementById(id));

function updateFilterPanelState() {
    const hasFilters = filterFields.some(el => el.value.trim() !== "");
    if (hasFilters) {
        filtersPanel.classList.add("open");
    } else {
        filtersPanel.classList.remove("open");
    }
}
document.getElementById("itemsPerPage").addEventListener("change", () => {
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

document.getElementById("addSharedExpenseBtn").addEventListener("click", createInlineSharedExpenseRow);
document.getElementById("addSettlementInlineBtn")
    .addEventListener("click", createInlineSettlementRow);

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


    // ===== Lista betöltése =====
    document.getElementById("loadListBtn").addEventListener("click", loadTransactions);
    // Kezdőlap indításakor
    showPage("transactions");
    loadSharedExpenses();
});

// ===== SZŰRŐK TÖRLÉSE =====
document.getElementById("clearFiltersBtn").addEventListener("click", () => {

    const fields = [
        "filterMonth", "filterDate", "filterAmount", "filterTitle",
        "filterCategory", "filterPaymentType", "filterType",
        "filterShared", "filterStatement"
    ];
    // mezők kiürítése
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // szűrőpanel bezárása
    const filtersPanel = document.getElementById("filtersPanel");
    filtersPanel.classList.remove("open");

    // teljes lista újratöltése
    loadTransactions();
});
    

// ======================================================
// FORMÁZÓ FÜGGVÉNYEK – DÁTUM, ÖSSZEG
// ======================================================

function formatDateForList(dateStr) {
    if (!dateStr) return "";

    // Ha már magyar formátumban van (YYYY.MM.DD.), akkor hagyjuk
    if (/^\d{4}\.\d{2}\.\d{2}\.$/.test(dateStr)) {
        return dateStr;
    }
    // Ha YYYY.MM.DD (pont nélkül)
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(dateStr)) {
        return dateStr + ".";
    }
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return dateStr;

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");

    return `${y}.${m}.${d}.`;
}

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

async function loadTransactions() {
    const result = await api.getTransactions();
    const tbody = document.getElementById("transactionsBody");

    if (!result || !result.success) {
        tbody.innerHTML = `<tr><td colspan="10">Hiba a betöltéskor.</td></tr>`;
        return;
    }

    const data = result.data;

    // --- Szűrőmezők ---
    const fMonth = document.getElementById("filterMonth").value.trim();
    const fDate = document.getElementById("filterDate").value.trim();
    const fAmount = document.getElementById("filterAmount").value.trim();
    const fTitle = document.getElementById("filterTitle").value.trim().toLowerCase();
    const fCategory = document.getElementById("filterCategory").value.trim().toLowerCase();
    const fType = document.getElementById("filterType").value;
    const fPayment = document.getElementById("filterPaymentType").value.trim().toLowerCase();
    const fShared = document.getElementById("filterShared").value;
    const fStatement = document.getElementById("filterStatement").value.trim().toLowerCase();

    // --- Szűrés ---
    const filtered = data.filter(tx => {

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

        if (fType && tx.transaction_type !== fType) return false;

        // Megosztott? szűrés javítása
        if (fShared) {
            // backend: "x" = megosztott, "" = nem megosztott
            const sharedValue = tx.is_shared === "x" ? "x" : "0";
            if (sharedValue !== fShared) return false;
        }


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

    filtered.sort((a, b) => {
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


    // ===== ÚJ: találatok számának kijelzése =====
    const rc = document.getElementById("transactions-result-count");
    if (rc) {
        rc.textContent = `Találatok: ${filtered.length} db`;
    }
        // --- Kiírás ---
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10">Nincs megjeleníthető adat.</td></tr>`;
            return;
        }

        // --- Elemszám kezelése (itemsPerPage) ---
        const itemsPerPageSelect = document.getElementById("itemsPerPage");
        let itemsPerPageValue = itemsPerPageSelect ? itemsPerPageSelect.value : "all";
        const paginationBox = document.getElementById("transactions-pagination");
        const pageInfo = document.getElementById("txPageInfo");
        const prevBtn = document.getElementById("txPrevPageBtn");
        const nextBtn = document.getElementById("txNextPageBtn");

        if (itemsPerPageValue !== "all") {
            const limit = parseInt(itemsPerPageValue, 10);
            const totalPages = Math.max(1, Math.ceil(filtered.length / limit));

            // felső korlát biztosítása
            txCurrentPage = Math.min(
                Math.max(txCurrentPage, 1),
                totalPages
            );


            if (paginationBox) paginationBox.style.display = "flex";
            if (pageInfo) pageInfo.textContent = `Oldal: ${txCurrentPage} / ${totalPages}`;

            if (prevBtn) prevBtn.disabled = (txCurrentPage <= 1);
            if (nextBtn) nextBtn.disabled = (txCurrentPage >= totalPages);
        } else {
            // Összes elem esetén nincs lapozás
            txCurrentPage = 1;
            if (paginationBox) paginationBox.style.display = "none";
        }
        const txFirstBtn = document.getElementById("txFirstPageBtn");
        const txLastBtn  = document.getElementById("txLastPageBtn");

        if (txFirstBtn) {
            txFirstBtn.addEventListener("click", () => {
                txCurrentPage = 1;
                loadTransactions();
            });
        }

        if (txLastBtn) {
            txLastBtn.addEventListener("click", () => {
                const itemsPerPageValue = document.getElementById("itemsPerPage").value;
                if (itemsPerPageValue === "all") {
                    txCurrentPage = 1;
                    loadTransactions();
                    return;
                }

                const limit = parseInt(itemsPerPageValue, 10);
                const totalPages = Math.max(
                    1,
                    Math.ceil(currentTransactions.length / limit)
                );

                txCurrentPage = totalPages;
                loadTransactions();
            });
        }


        let visibleItems = filtered;

        if (itemsPerPageValue !== "all") {
            const limit = parseInt(itemsPerPageValue, 10);

            const start = (txCurrentPage - 1) * limit;
            const end = start + limit;

            visibleItems = filtered.slice(start, end);
        } else {
            txCurrentPage = 1;
        }


        let rows = "";

        visibleItems.forEach(tx => {
            rows += `
                <tr data-id="${tx.id}">
                    <td>${tx.month}</td>
                    <td>${formatDateForList(tx.date)}</td>
                    <td class="${
                        (() => {
                            const t = String(tx.transaction_type || "").trim().toLowerCase();

                            const isSaving  = t.includes("megtak") || t === "saving";
                            const isExpense = t.includes("kiad")  || t === "expense" || (Number(tx.amount) < 0);
                            const isIncome  = t.includes("bev")   || t === "income"  || (Number(tx.amount) > 0);

                            if (isSaving)  return "amount-saving";
                            if (isExpense) return "amount-expense";
                            if (isIncome)  return "amount-income";
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

                    <td>${tx.statement_item}</td>
                </tr>
            `;
        });


    tbody.innerHTML = rows;
    
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
});}


function openTransactionEditor(tx) {
    const modal = document.getElementById("txModal");
    const overlay = document.getElementById("modalOverlay");

    // mezők kitöltése
    // ISO → yyyy-MM-dd
    const dateOnly = tx.date.split("T")[0];
    document.querySelector("input[name='date']").value = dateOnly;
    document.querySelector("input[name='month']").value = tx.month;
    document.querySelector("input[name='amount']").value = Math.abs(Number(tx.amount) || 0);
    document.querySelector("input[name='title']").value = tx.title;
    document.querySelector("input[name='category']").value = tx.category;
    document.querySelector("input[name='payment_type']").value = tx.payment_type;
    document.querySelector("input[name='transaction_type']").value = tx.transaction_type;
    document.querySelector("input[name='is_shared']").checked =
    (tx.is_shared === "x" || tx.is_shared === true || tx.is_shared === "true");
    document.querySelector("input[name='statement_item']").value = tx.statement_item;

    // a szerkesztendő ID-t eltároljuk a formban (nem látszik, de szükséges)
    document.getElementById("txForm").setAttribute("data-edit-id", tx.id);

    // modal megnyitása
    modal.classList.add("open");
    overlay.classList.add("open");
}

// Váltás a két panel között
function showPage(page) {
    const txPage   = document.getElementById("page-transactions");
    const sharedPage = document.getElementById("page-shared-expenses");

    const txBtn    = document.getElementById("showTransactionsBtn");
    const sharedBtn = document.getElementById("showSharedExpensesBtn");

    if (page === "transactions") {
        txPage.classList.remove("hidden");
        sharedPage.classList.add("hidden");

        txBtn.classList.add("active");
        sharedBtn.classList.remove("active");

        // tranzakciók újratöltése, ha kell
        loadTransactions();

    } else if (page === "shared") {
        txPage.classList.add("hidden");
        sharedPage.classList.remove("hidden");

        txBtn.classList.remove("active");
        sharedBtn.classList.add("active");

        // megosztott költségek betöltése
        loadSharedExpenses();
    }
}

document.getElementById("showTransactionsBtn").addEventListener("click", () => {
    showPage("transactions");
});

document.getElementById("showSharedExpensesBtn").addEventListener("click", () => {
    showPage("shared");
});

async function loadSharedExpenses() {
    try {
        const result = await api.getSharedExpenses();
        const valueSetsResponse = await api.getValueSets();

        if (!result || !result.success) {
            console.error("Nem sikerült betölteni a megosztott költségeket.", result);
            return;
        }
                if (!valueSetsResponse || !valueSetsResponse.success) {
            console.error("Nem sikerült betölteni a value seteket.", valueSetsResponse);
            return;
        }

        const valueSets = valueSetsResponse.sets || {};
        const tbody = document.getElementById("sharedExpensesBody");
        tbody.innerHTML = "";
        // ===== DÁTUM SZERINTI RENDEZÉS (ÚJ FELÜL) =====
        // 1) Rendezés: legrégebbi → legújabb
        result.data.sort((a, b) => new Date(a.date) - new Date(b.date));
        // ====== EGYENLEG SZÁMÍTÁSA (PIROS - KÉK) ======
        let blueTotal = 0; // Zsolti tartozása (paid_by = Dóri)
        let redTotal  = 0; // Dóri tartozása  (paid_by = Zsolti)

        for (const row of (result.data || [])) {
            const paidBy = String(row.paid_by || "").trim().toLowerCase();

            // Tartozás összege: az adott fél "egyenleg" mezője (abs értékkel)
            if (paidBy === "dóri" || paidBy === "dori") {
                blueTotal += Math.abs(Number(row.Zsolti_balance) || 0);
            } else if (paidBy === "zsolti") {
                redTotal += Math.abs(Number(row.Dori_balance) || 0);
            }
        }

        const headerNet = redTotal - blueTotal;

        // ====== EGYENLEG KIÍRÁSA A FEJLÉC ALATTI DOBOZBA ======
        const box = document.getElementById("sharedBalanceValue");
        const label = document.getElementById("sharedBalanceLabel");

        // A HTML-ben ezek az ID-k léteznek:contentReference[oaicite:2]{index=2}
        if (box) box.textContent = Math.abs(headerNet).toFixed(0) + " Ft";

        if (label) {
            if (headerNet > 0) {
                label.textContent = " — Dóri tartozik (piros)";
                label.className = "balance-negative"; // nálad ez a piros stílus
            } else if (headerNet < 0) {
                label.textContent = " — Zsolti tartozik (kék)";
                label.className = "balance-positive"; // nálad ez a kék stílus
            } else {
                label.textContent = " — Az elszámolás kiegyenlített";
                label.className = "";
            }
        }

        result.data.forEach(row => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${row.month || ""}</td>
                <td>${formatDateForList(row.date)}</td>
                <td>${row.title || ""}</td>
                <td>${formatAmount(row.amount)}</td>
                <td>${row.paid_by || ""}</td>

                <td>
                    <input
                        type="number"
                        step="1"
                        class="se-zsolti-amount"
                        data-id="${row.id}"
                        value="${row.Zsolti_amount === 0 ? 0 : (Math.abs(Number(row.Zsolti_amount) || 0) || "")}"


                    >
                </td>

                <td>
                    <input
                        type="number"
                        step="1"
                        class="se-dori-amount"
                        data-id="${row.id}"
                        value="${row.Dori_amount === 0 ? 0 : (Math.abs(Number(row.Dori_amount) || 0) || "")}"

                    >
                </td>

                <td>${formatAmount(row.remaining_amount)}</td>
                ${(() => {
                    const paidBy = String(row.paid_by || "").trim().toLowerCase();

                    const paidByDori = paidBy.includes("dóri") || paidBy === "dori";
                    const paidByZsolti = paidBy.includes("zsolti");

                    // Default: nincs kiemelés
                    let zClass = "";
                    let dClass = "";

                    // Fizető: credit (kék), nem fizető: debit (piros)
                    // Kérés szerint: ha Dóri fizetett, Zsolti oldala legyen kiemelve (piros),
                    // és Dóri oldala kék. Ha Zsolti fizetett, fordítva.
                    if (paidByDori) {
                        zClass = "balance-debit";
                        dClass = "balance-credit";
                    } else if (paidByZsolti) {
                        zClass = "balance-credit";
                        dClass = "balance-debit";
                    }

                    return `
                        <td class="${zClass}">${formatAmount(row.Zsolti_balance)}</td>
                        <td class="${dClass}">${formatAmount(row.Dori_balance)}</td>
                    `;
                })()}

                ${(() => {
                    const paidBy = String(row.paid_by || "").trim().toLowerCase();

                    const paidByDori   = paidBy.includes("dóri") || paidBy === "dori";
                    const paidByZsolti = paidBy.includes("zsolti");

                    let value = "";
                    let cls   = "";

                    if (paidByDori) {
                        // Dóri fizetett → Zsolti egyenlege jelenjen meg (kék)
                        value = row.Zsolti_balance;
                        cls   = "balance-zsolti";
                    } else if (paidByZsolti) {
                        // Zsolti fizetett → Dóri egyenlege jelenjen meg (piros)
                        value = row.Dori_balance;
                        cls   = "balance-dori";
                    }

                    return `<td class="${cls}">${formatAmount(value)}</td>`;
                })()}


                <td>
                    <input 
                        type="text" 
                        class="se-notes" 
                        data-id="${row.id}" 
                        value="${row.notes || ""}"
                    >
                </td>

            `;


            tbody.appendChild(tr);
       
        });

    } 
    catch (err) {
        console.error("Hiba a megosztott költségek betöltésekor:", err);
    }
}
// ===== Shared Expenses – Event Delegation =====
document.getElementById("sharedExpensesBody").addEventListener("change", async (e) => {
    const target = e.target;
    const rowId = target.getAttribute("data-id");
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

        value = Number(value);
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Zsolti része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }

        await api.updateSharedExpense(rowId, "Zsolti_amount", value);
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

        value = Number(value);
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Dóri része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }

        await api.updateSharedExpense(rowId, "Dori_amount", value);
        await loadSharedExpenses();
        return;
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
    const doriAmount   = Math.abs(Number(tr.querySelector(".se-new-doriamount").value || 0));
    const notes        = (tr.querySelector(".se-new-notes")?.value || "").trim();



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
        alert("Hiba az új megosztott költség mentésekor.");
        return;
    }

    // inline sor eltávolítása és lista frissítése
    tr.remove();
    await loadSharedExpenses();
}
function createInlineSettlementRow() {
    const tbody = document.getElementById("sharedExpensesBody");
    if (!tbody) return;

    // Meglévő új sor ne lehessen egyszerre
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

        <td>0</td>
        <td></td>
        <td></td>

        <td>
            <input type="text" class="set-notes" placeholder="Megjegyzés">
        </td>

        <td>
            <button class="btn-primary save-settlement">Mentés</button>
            <button class="btn-secondary cancel-settlement">Mégse</button>
        </td>
    `;

    tbody.prepend(tr);
tr.querySelector(".cancel-settlement").addEventListener("click", () => tr.remove());
tr.querySelector(".save-settlement").addEventListener("click", saveInlineSettlement);

}


async function saveInlineSettlement() {
    const tr = document.querySelector(".new-settlement-row");
    if (!tr) return;

    const date = tr.querySelector(".set-date").value;
    const title = tr.querySelector(".set-title").value.trim();
    const amount = Math.abs(Number(tr.querySelector(".set-amount").value));
    const paidBy = tr.querySelector(".set-paidby").value.trim();
    const notes = tr.querySelector(".set-notes").value.trim();

    if (!date || !title || !amount || isNaN(amount)) {
        alert("Dátum, megnevezés és összeg kötelező.");
        return;
    }


    const month = deriveMonth(date);

    const response = await api.addSharedExpense({
        month,
        date,
        title,
        amount,
        paid_by: paidBy,
        own_amount: 0,
        notes
    });

    if (!response || !response.success) {
        alert("Hiba történt a törlesztés mentésekor.");
        return;
    }

    tr.remove();
    await loadSharedExpenses();
}
function addSharedExpense_(p) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Shared_Expenses");
  if (!sheet) {
    return { success: false, error: 'Nem található a "Shared_Expenses" munkalap.' };
  }

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const colId            = header.indexOf("id");
  const colMonth         = header.indexOf("month");
  const colDate          = header.indexOf("date");
  const colTitle         = header.indexOf("title");
  const colAmount        = header.indexOf("amount");
  const colPaidBy        = header.indexOf("paid_by");
  const colZsoltiAmount  = header.indexOf("Zsolti_amount");
  const colDoriAmount    = header.indexOf("Dori_amount");
  const colRemaining     = header.indexOf("remaining_amount");
  const colZsoltiBalance = header.indexOf("Zsolti_balance");
  const colDoriBalance   = header.indexOf("Dori_balance");
  const colBalanceImpact = header.indexOf("balance_impact");
  const colNotes         = header.indexOf("notes");

  const newId  = generatePrefixedId_("SE");

  const dateRaw = p.date || "";
  const month   = p.month || deriveMonthFromDate_(dateRaw);

  const title  = p.title || "";
  const paidBy = (p.paid_by || "Zsolti").trim();

  const amountAbs  = Math.abs(Number(p.amount) || 0);
  const zAbs       = Math.abs(Number(p.Zsolti_amount) || 0);
  const dAbs       = Math.abs(Number(p.Dori_amount) || 0);
  const notes      = p.notes || "";

  const remaining      = amountAbs - dAbs - zAbs;
  const halfRemaining  = remaining / 2;
  const zsoltiBal      = halfRemaining + zAbs;
  const doriBal        = halfRemaining + dAbs;

  // A kért "Egyenleg" mező: a NEM fizető fél egyenlege (pozitív, előjel nélkül tárolva)
  const paidByNorm = paidBy.toLowerCase();
  let balanceImpact = 0;
  if (paidByNorm === "dóri" || paidByNorm === "dori") {
    balanceImpact = zsoltiBal;   // Dóri fizetett → Zsolti egyenlege
  } else if (paidByNorm === "zsolti") {
    balanceImpact = doriBal;     // Zsolti fizetett → Dóri egyenlege
  }

  const newRow = new Array(header.length).fill("");

  if (colId !== -1)            newRow[colId] = newId;
  if (colMonth !== -1)         newRow[colMonth] = month;
  if (colDate !== -1)          newRow[colDate] = formatDateForStore_(dateRaw);
  if (colTitle !== -1)         newRow[colTitle] = title;
  if (colAmount !== -1)        newRow[colAmount] = amountAbs;
  if (colPaidBy !== -1)        newRow[colPaidBy] = paidBy;
  if (colZsoltiAmount !== -1)  newRow[colZsoltiAmount] = zAbs;
  if (colDoriAmount !== -1)    newRow[colDoriAmount] = dAbs;
  if (colRemaining !== -1)     newRow[colRemaining] = remaining;
  if (colZsoltiBalance !== -1) newRow[colZsoltiBalance] = zsoltiBal;
  if (colDoriBalance !== -1)   newRow[colDoriBalance] = doriBal;
  if (colBalanceImpact !== -1) newRow[colBalanceImpact] = balanceImpact;
  if (colNotes !== -1)         newRow[colNotes] = notes;

  sheet.appendRow(newRow);

  return { success: true, id: newId };
}
