document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const content = document.querySelector(".content-wrapper");
    const hamburger = document.getElementById("hamburgerBtn");
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");

    const applyDesktopState = (collapsed) => {
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        sidebar.classList.toggle("collapsed", collapsed);
        content.classList.toggle("sidebar-collapsed", collapsed);

        if (sidebarToggleBtn) {
            sidebarToggleBtn.textContent = collapsed ? "▶" : "◀";

        }
        localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    };

    const isMobile = () => window.matchMedia("(max-width: 700px)").matches;

    // induló állapot (desktopon mentett beállítás)
    if (!isMobile()) {
        const saved = localStorage.getItem("sidebarCollapsed") === "1";
        applyDesktopState(saved);
    }

    // Hamburger: mobilon open/close, desktopon collapsed toggle
    hamburger?.addEventListener("click", () => {
        if (isMobile()) {
            sidebar.classList.toggle("open");
        } else {
            applyDesktopState(!sidebar.classList.contains("collapsed"));
        }
    });

    // Sidebar tetején lévő gomb: desktopon collapsed toggle (mobilon is működhet, de ott inkább a hamburger a UX)
    sidebarToggleBtn?.addEventListener("click", () => {
        if (isMobile()) {
            sidebar.classList.toggle("open");
        } else {
            applyDesktopState(!sidebar.classList.contains("collapsed"));
        }
    });

    // Ha átméretezed az ablakot, a logika ne “ragadjon be”
    window.addEventListener("resize", () => {
        if (isMobile()) {
            // mobil: a collapsed desktop állapotot ne erőltesse
            document.body.classList.remove("sidebar-collapsed");
            sidebar.classList.remove("collapsed");
            content.classList.remove("sidebar-collapsed");
        } else {
            const saved = localStorage.getItem("sidebarCollapsed") === "1";
            applyDesktopState(saved);
            sidebar.classList.remove("open"); // desktopon ne használjuk az "open"-t
        }
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
    // Tranzakció törlése modalból
document.getElementById("txDeleteBtn")?.addEventListener("click", async () => {
    const form = document.getElementById("txForm");
    const txId = form?.getAttribute("data-edit-id");

    if (!txId) return;

    const ok = confirm("Biztosan törlöd ezt a tranzakciót? A kapcsolódó tételek is törlődhetnek.");
    if (!ok) return;

    try {
        const resp = await api.deleteTransaction(txId);
        if (!resp || !resp.success) {
            alert(resp?.error || resp?.message || "A törlés nem sikerült.");
            return;
        }

document.getElementById("txModal")?.classList.remove("open");
document.getElementById("modalOverlay")?.classList.remove("open");
loadTransactions();

    } catch (err) {
        console.error("deleteTransaction error:", err);
        alert("Váratlan hiba történt a törlés során.");
    }
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

// ===== SHARED EXPENSES – FEJLÉCRE KATTINTVA RENDEZÉS (CSAK STATE) =====
document.querySelectorAll("#sharedExpensesTable thead th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;

        if (seSortField === field) {
            seSortDirection = (seSortDirection === "asc") ? "desc" : "asc";
        } else {
            seSortField = field;
            seSortDirection = "asc";
        }

        loadSharedExpenses();
    });
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
// ================================
// Shared Expenses – Modal open/close (NEW only)
// ================================
function hideSeModalMessages() {
    const ok = document.getElementById("seSuccessMsg");
    const er = document.getElementById("seErrorMsg");
    if (ok) ok.style.display = "none";
    if (er) er.style.display = "none";
}
let seModalIsSettlement = false;

function openSeModal(isSettlement) {
    seModalIsSettlement = !!isSettlement;
    const modal = document.getElementById("seModal");
    const overlay = document.getElementById("seModalOverlay");
    if (!modal || !overlay) return;

    // form reset
    const form = document.getElementById("seForm");
    if (form) {
        form.reset();
        form.removeAttribute("data-edit-id"); // <-- ÚJ: ne maradjon bent régi edit mód
    }

    // ÚJ: alapból ne lehessen törölni (csak szerkesztésnél, feltételesen)
    document.getElementById("seDeleteBtn")?.style.setProperty("display", "none");

    hideSeModalMessages();


    // cím + törlesztésnél bontás elrejtése
    const titleEl = document.getElementById("seModalTitle");
    const splitBlock = document.getElementById("seSplitBlock");
    if (titleEl) titleEl.textContent = isSettlement ? "Új törlesztés" : "Új megosztott tétel";
    if (splitBlock) splitBlock.style.display = isSettlement ? "none" : "block";

    // alapértékek (csak UX)
    const paidBy = document.getElementById("sePaidBy");
    if (paidBy && !paidBy.value) paidBy.value = "Zsolti";

    const name = document.getElementById("seTitle");
    if (name && isSettlement) name.value = "Törlesztés";

    modal.classList.add("open");
    overlay.classList.add("open");
}
window.openSeModal = openSeModal;

function closeSeModal() {
    document.getElementById("seModal")?.classList.remove("open");
    document.getElementById("seModalOverlay")?.classList.remove("open");
}

document.getElementById("addSharedExpenseBtn").addEventListener("click", () => openSeModal(false));
document.getElementById("addSettlementInlineBtn")
    .addEventListener("click", () => openSeModal(true));
document.getElementById("seCloseBtn")?.addEventListener("click", closeSeModal);
// Megosztott / törlesztés tétel törlése modalból (csak törlesztés vagy paid_by=Zsolti)
document.getElementById("seDeleteBtn")?.addEventListener("click", async () => {
    const form = document.getElementById("seForm");
    const seId = form?.getAttribute("data-edit-id");
    if (!seId) return;

    // Frontend védelem: csak törlesztés vagy paid_by=Zsolti törölhető
    const row = seRowsById?.get(String(seId));
    const title = String(row?.title || "").trim().toLowerCase();
    const paidBy = String(row?.paid_by || "").trim().toLowerCase();
    const isSettlement = title.includes("törleszt");
    const isPaidByZsolti = (paidBy === "zsolti");
    const canDelete = isSettlement || isPaidByZsolti;

    if (!canDelete) {
        alert("Ez a tétel nem törölhető. Csak törlesztés vagy paid_by = Zsolti tétel törölhető.");
        return;
    }

    const ok = confirm("Biztosan törlöd ezt a tételt?");
    if (!ok) return;

    try {
        const resp = await api.deleteSharedExpense(seId);
        if (!resp || !resp.success) {
            alert(resp?.error || resp?.message || "A törlés nem sikerült.");
            return;
        }

        document.getElementById("seModal")?.classList.remove("open");
        document.getElementById("seModalOverlay")?.classList.remove("open");

        loadSharedExpenses();
    } catch (err) {
        console.error("deleteSharedExpense error:", err);
        alert("Váratlan hiba történt a törlés során.");
    }
});


// Modal – dátum → hónap automatikus kitöltés
document.getElementById("seDate")?.addEventListener("input", (e) => {
    const dateVal = e.target.value;
    const monthInput = document.getElementById("seMonth");
    if (!monthInput) return;

    monthInput.value = dateVal ? deriveMonth(dateVal) : "";
});
// Modal – Mentés (ÚJ tétel / ÚJ törlesztés)
document.getElementById("seForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editingRowId = document.getElementById("seModal").getAttribute("data-edit-id") || "";

    hideSeModalMessages();

    const date  = (document.getElementById("seDate")?.value || "").trim();
    const title = (document.getElementById("seTitle")?.value || "").trim();
    const paidBy = (document.getElementById("sePaidBy")?.value || "").trim();
    const notes  = (document.getElementById("seNotes")?.value || "").trim();

    // Fontos: parseHuNumber kezeli a "2 000" és "2,5" formátumot is
    const amount = Math.abs(parseHuNumber(document.getElementById("seAmount")?.value));
    const zRaw = document.getElementById("seZsoltiAmount")?.value;
    const dRaw = document.getElementById("seDoriAmount")?.value;

    const zsoltiAmount = seModalIsSettlement ? 0 : Math.abs(parseHuNumber(zRaw || 0) || 0);
    const doriAmount   = seModalIsSettlement ? 0 : Math.abs(parseHuNumber(dRaw || 0) || 0);

    if (!date || !title || !paidBy || isNaN(amount)) {
        document.getElementById("seErrorMsg").style.display = "block";
        alert("Dátum, megnevezés, fizette és összeg kötelező (összeg szám legyen).");
        return;
    }

    const month = deriveMonth(date);

    try {
        const payload = {
            month,
            date,
            title,
            amount,
            paid_by: paidBy,
            Zsolti_amount: zsoltiAmount,
            Dori_amount: doriAmount,
            notes
        };

        if (seModalIsSettlement) payload.settlement = "x";

        const editId = document.getElementById("seForm")?.getAttribute("data-edit-id");

        let response;
        if (editId) {
            response = await api.updateSharedExpenseRow({ ...payload, id: editId });
        } else {
            response = await api.addSharedExpense(payload);
        }


        if (!response || !response.success) {
            console.error("addSharedExpense FAILED:", response);
            document.getElementById("seErrorMsg").style.display = "block";
            alert(response?.error || response?.message || "Hiba történt a mentéskor.");
            return;
        }

        document.getElementById("seSuccessMsg").style.display = "block";
        closeSeModal();
        await loadSharedExpenses();
    } catch (err) {
        console.error("Shared Expense modal save error:", err);
        document.getElementById("seErrorMsg").style.display = "block";
        alert("Váratlan hiba történt a mentés során.");
    }
});


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
function toInputDateLocal(value) {
  if (!value) return "";

  // már jó formátum: YYYY-MM-DD
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;

  // ISO / Date string -> helyi dátum (nem UTC nap)
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

async function loadTransactions() {
        // ===== SORT ICONS RESET (TRANSACTIONS) =====
    document.querySelectorAll("#transactionsTable thead th[data-sort]").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.getAttribute("data-sort") === txSortField) {
            th.classList.add(txSortDirection === "asc" ? "sort-asc" : "sort-desc");
        }
    });

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
    const fType = document.getElementById("filterType").value.trim().toLowerCase();
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

        if (fType && String(tx.transaction_type || "").trim().toLowerCase() !== fType) return false;

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
    document.getElementById("txDeleteBtn")?.style.setProperty("display", "inline-block");

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
                // ===== SORT ICONS RESET (SHARED EXPENSES) =====
        document.querySelectorAll("#sharedExpensesTable thead th[data-sort]").forEach(th => {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === seSortField) {
                th.classList.add(seSortDirection === "asc" ? "sort-asc" : "sort-desc");
            }
        });
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
        seRowsById = new Map();
// ===== DÁTUM SZERINTI RENDEZÉS (ÚJ FELÜL) =====
        // 1) Rendezés: legrégebbi → legújabb
        // ===== RENDEZÉS (fejlécre kattintás alapján) =====
        const seDir = (seSortDirection === "asc") ? 1 : -1;

        const seToNum = (v) => {
            const n = Number(String(v ?? "").replace(/\s+/g, "").replace(",", "."));
            return isNaN(n) ? null : n;
        };

        const seToTime = (v) => {
            const t = new Date(v).getTime();
            return isNaN(t) ? null : t;
        };

        (result.data || []).sort((a, b) => {
            const va = a?.[seSortField];
            const vb = b?.[seSortField];

            // null/undefined a végére
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;

            // szám mezők
            const numFields = new Set([
                "amount",
                "Zsolti_amount",
                "Dori_amount",
                "remaining_amount",
                "Zsolti_balance",
                "Dori_balance",
                "balance_impact"
            ]);

            if (numFields.has(seSortField)) {
                const na = seToNum(va);
                const nb = seToNum(vb);
                if (na == null && nb == null) return 0;
                if (na == null) return 1;
                if (nb == null) return -1;
                return (na - nb) * seDir;
            }

            // dátum mező
            if (seSortField === "date") {
                const ta = seToTime(va);
                const tb = seToTime(vb);
                if (ta == null && tb == null) return 0;
                if (ta == null) return 1;
                if (tb == null) return -1;
                return (ta - tb) * seDir;
            }

            // minden más: szöveg
            const sa = String(va).toLowerCase();
            const sb = String(vb).toLowerCase();
            return sa.localeCompare(sb, "hu") * seDir;
        });

        // ====== EGYENLEG SZÁMÍTÁSA (PIROS - KÉK + LILA) ======
        let blueTotal = 0;    // kék: Zsolti tartozása (paid_by = Dóri)
        let redTotal  = 0;    // piros: Dóri tartozása  (paid_by = Zsolti)
        let purpleTotal = 0;  // lila: törlesztés tételek összege
        const isSettlementRow = (r) => {
            const t = String(r.title || "").trim().toLowerCase();
            // Stabil, egyszerű szabály: "törleszt" szó alapján
            return t.includes("törleszt");
        };
        for (const row of (result.data || [])) {
            const paidBy = String(row.paid_by || "").trim().toLowerCase();
            if (isSettlementRow(row)) {
                purpleTotal += Math.abs(Number(row.amount) || 0);
                continue;
            }
            if (paidBy === "dóri" || paidBy === "dori") {
                blueTotal += Math.abs(Number(row.Zsolti_balance) || 0);
            } else if (paidBy === "zsolti") {
                redTotal += Math.abs(Number(row.Dori_balance) || 0);
            }
        }
        const headerNet = (redTotal - blueTotal) + purpleTotal;
        // ====== EGYENLEG KIÍRÁSA A FEJLÉC ALATTI DOBOZBA ======
        const box = document.getElementById("sharedBalanceValue");
        const label = document.getElementById("sharedBalanceLabel");

        // ====== RÉSZÖSSZEGEK KIÍRÁSA (KÉK / PIROS / TÖRLESZTÉS) ======
        const blueEl   = document.getElementById("sharedBlueTotal");
        const redEl    = document.getElementById("sharedRedTotal");
        const purpleEl = document.getElementById("sharedPurpleTotal");

        if (blueEl)   blueEl.textContent   = formatAmount(blueTotal);
        if (redEl)    redEl.textContent    = formatAmount(redTotal);
        if (purpleEl) purpleEl.textContent = formatAmount(purpleTotal);


        // A HTML-ben ezek az ID-k léteznek:contentReference[oaicite:2]{index=2}
        if (box) box.textContent = Math.abs(headerNet).toFixed(0) + " Ft";

        if (label) {
            if (headerNet > 0) {
                label.textContent = " — Dóri tartozik";
                label.className = "balance-negative"; // nálad ez a piros stílus
            } else if (headerNet < 0) {
                label.textContent = " — Zsolti tartozik";
                label.className = "balance-positive"; // nálad ez a kék stílus
            } else {
                label.textContent = " — Az elszámolás kiegyenlített";
                label.className = "";
            }
        }

        result.data.forEach(row => {
            const tr = document.createElement("tr");
            seRowsById.set(String(row.id), row);
            tr.setAttribute("data-id", row.id);

            const isSettlement = String(row.title || "").trim().toLowerCase().includes("törleszt");

        if (isSettlement) {
            tr.classList.add("settlement-row");
            tr.innerHTML = `
                <td>${row.month || ""}</td>
                <td>${formatDateForList(row.date)}</td>
                <td>${row.title || "Törlesztés"}</td>
                <td class="se-amount">${formatAmount(row.amount)}</td>
                <td>${row.paid_by || ""}</td>

                <!-- Megosztott mezők elrejtése -->
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>

                <!-- Egyenleg lila -->
                <td class="balance-settlement">${formatAmount(row.amount)}</td>

                <td>
                    ${row.notes || ""}
                </td>

            `;
            tbody.appendChild(tr);
            return;
        }

        // ----- Nem törlesztés: marad a meglévő (megosztott) render -----
        tr.innerHTML = `
            <td>${row.month || ""}</td>
            <td>${formatDateForList(row.date)}</td>
            <td>${row.title || ""}</td>
            <td class="text-right">${formatAmount(row.amount)}</td>
            <td>${row.paid_by || ""}</td>

            <td class="text-right">
                ${formatAmount(Math.abs(Number(row.Zsolti_amount) || 0))}
            </td>

            <td class="text-right">
                ${formatAmount(Math.abs(Number(row.Dori_amount) || 0))}
            </td>



            <td class="text-right se-remaining">${formatAmount(row.remaining_amount)}</td>


            ${(() => {
                const paidBy = String(row.paid_by || "").trim().toLowerCase();
                const paidByDori = paidBy.includes("dóri") || paidBy === "dori";
                const paidByZsolti = paidBy.includes("zsolti");

                let zClass = "";
                let dClass = "";

                if (paidByDori) {
                    zClass = "balance-debit";
                    dClass = "balance-credit";
                } else if (paidByZsolti) {
                    zClass = "balance-credit";
                    dClass = "balance-debit";
                }

                return `
                    <td class="text-right se-zsolti-balance">${formatAmount(row.Zsolti_balance)}</td>
                    <td class="text-right se-dori-balance">${formatAmount(row.Dori_balance)}</td>
                `;
            })()}

            ${(() => {
                const paidBy = String(row.paid_by || "").trim().toLowerCase();
                const paidByDori   = paidBy.includes("dóri") || paidBy === "dori";
                const paidByZsolti = paidBy.includes("zsolti");

                let value = "";
                let cls   = "";

                if (paidByDori) {
                    value = row.Zsolti_balance;
                    cls   = "balance-zsolti";
                } else if (paidByZsolti) {
                    value = row.Dori_balance;
                    cls   = "balance-dori";
                }

                return `<td class="text-right se-balance">${formatAmount(value)}</td>`;
            })()}

        <td>
            ${row.notes || ""}
        </td>

        `;
        tbody.appendChild(tr);
        });

    } 
    catch (err) {
        console.error("Hiba a megosztott költségek betöltésekor:", err);
    }
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
    document.getElementById("seZsoltiAmount").value = Math.abs(Number(row.Zsolti_amount) || 0);
    document.getElementById("seDoriAmount").value = Math.abs(Number(row.Dori_amount) || 0);

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

    // ... innen folytatódjon a te meglévő kódod változatlanul ...


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
    const doriBal   = halfRemaining + d;

    // DOM frissítések
    const remCell = tr.querySelector(".se-remaining");
    const zbCell  = tr.querySelector(".se-zsolti-balance");
    const dbCell  = tr.querySelector(".se-dori-balance");
    const bCell   = tr.querySelector(".se-balance");

    if (remCell) remCell.textContent = formatAmount(remaining);
    if (zbCell)  zbCell.textContent  = formatAmount(zsoltiBal);
    if (dbCell)  dbCell.textContent  = formatAmount(doriBal);

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

    const date  = tr.querySelector(".set-date").value;
    const title = (tr.querySelector(".set-title").value || "Törlesztés").trim();
    const amount = Math.abs(Number(tr.querySelector(".set-amount").value));
    const paidBy = (tr.querySelector(".set-paidby").value || "").trim();
    const notes  = (tr.querySelector(".set-notes").value || "").trim();

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
