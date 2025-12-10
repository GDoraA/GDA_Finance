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
    loadTransactions();
});
document.getElementById("addSharedExpenseBtn").addEventListener("click", createInlineSharedExpenseRow);

// Minden szűrőmező változásakor:
// 1) frissítjük a panel nyitott/zárt állapotát
// 2) újratöltjük a listát az aktuális szűrőfeltételekkel
filterFields.forEach(el => {
    el.addEventListener("input", () => {
        updateFilterPanelState();  // panel nyit/zár logika
        loadTransactions();        // lista újraszámítása a szűrők alapján
    });
});


    // ===== Lista betöltése =====
    document.getElementById("loadListBtn").addEventListener("click", loadTransactions);
    // Kezdőlap indításakor
    showPage("transactions");
    loadSharedExpenses();
});
// Oldal betöltésekor automatikusan listázunk
loadTransactions();
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
// ===== AUTOMATIKUS LISTA FRISSÍTÉS SZŰRÉS KÖZBEN =====

// Az összes szűrő mező listája
const autoFilterFields = [
    "filterMonth",
    "filterDate",
    "filterAmount",
    "filterTitle",
    "filterCategory",
    "filterPaymentType",
    "filterType",
    "filterShared",
    "filterStatement"
].map(id => document.getElementById(id));

// Szűrőpanel állapotának frissítése
function updateFilterPanelState() {
    const hasFilters = autoFilterFields.some(el => el.value.trim() !== "");
    const panel = document.getElementById("filtersPanel");

    if (hasFilters) {
        panel.classList.add("open");
    } else {
        panel.classList.remove("open");
    }
}

// Minden szűrő mező → automatikus frissítés
autoFilterFields.forEach(el => {
    el.addEventListener("input", () => {
        updateFilterPanelState();
        loadTransactions();
    });
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
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

        if (fDate && String(tx.date).trim() !== fDate) return false;

        // Összeg szűrés: támogatja a >1000 vagy <5000 formátumot
        if (fAmount) {
            if (fAmount.startsWith(">")) {
                const min = Number(fAmount.substring(1));
                if (!(Number(tx.amount) > min)) return false;
            } else if (fAmount.startsWith("<")) {
                const max = Number(fAmount.substring(1));
                if (!(Number(tx.amount) < max)) return false;
            } else {
                if (String(tx.amount) !== fAmount) return false;
            }
        }

        if (fTitle && !String(tx.title).toLowerCase().includes(fTitle)) return false;

        if (fCategory && !String(tx.category).toLowerCase().includes(fCategory)) return false;

        if (fPayment && !String(tx.payment_type).toLowerCase().includes(fPayment)) return false;

        if (fType && tx.transaction_type !== fType) return false;

        if (fShared && String(tx.is_shared) !== fShared) return false;

        if (fStatement && !String(tx.statement_item).toLowerCase().includes(fStatement)) return false;

        return true;
    });


        // --- Kiírás ---
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10">Nincs megjeleníthető adat.</td></tr>`;
            return;
        }

        // --- Elemszám kezelése (itemsPerPage) ---
        const itemsPerPageSelect = document.getElementById("itemsPerPage");
        let itemsPerPageValue = itemsPerPageSelect ? itemsPerPageSelect.value : "all";

        let visibleItems = filtered;
        if (itemsPerPageValue !== "all") {
            const limit = parseInt(itemsPerPageValue, 10);
            if (!isNaN(limit)) {
                visibleItems = filtered.slice(0, limit);
            }
        }

        let rows = "";

        visibleItems.forEach(tx => {
            rows += `
                <tr data-id="${tx.id}">
                    <td>${tx.month}</td>
                    <td>${formatDateForList(tx.date)}</td>
                    <td>${formatAmount(tx.amount)}</td>
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
    document.querySelector("input[name='amount']").value = tx.amount;
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

        result.data.forEach(row => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${row.month || ""}</td>
                <td>${formatDateForList(row.date)}</td>
                <td>${row.title || ""}</td>
                <td>${formatAmount(row.amount)}</td>
                <td>
                    <input
                        type="text"
                        class="se-paid-by-input"
                        data-id="${row.id}"
                        list="paidByList-${row.id}"
                        value="${row.paid_by || ""}"
                    >
                    <datalist id="paidByList-${row.id}">
                        ${valueSets.paid_by.map(v => `
                            <option value="${v}"></option>
                        `).join("")}
                    </datalist>
                </td>


                <td>
                    <input
                        type="number"
                        step="1"
                        class="se-own-amount"
                        data-id="${row.id}"
                        value="${row.own_amount === 0 ? 0 : (row.own_amount || "")}"
                    >
                </td>
                <td>${row.remaining_amount || ""}</td>
                <td>${row.partner_share || ""}</td>
                <td>${row.balance_impact || ""}</td>
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
            // --- ÚJ: Szerkeszthető mezők figyelése és küldése a backendnek ---

            // paid_by mezők figyelése
            document.querySelectorAll(".se-paid-by-input").forEach(input => {
                input.addEventListener("change", async (e) => {

                    const id = e.target.getAttribute("data-id");
                    const value = e.target.value.trim();

                    if (!value) return;

                    // 1) Először mentjük a Shared_Expenses táblába
                    await api.updateSharedExpense(id, "paid_by", value);

                    // 2) Majd friss value-set lekérése
                    const valueSets = await api.getValueSets();

                    // 3) Ha új érték → felvesszük a Value_Sets lapra
                    if (
                        !valueSets.sets.paid_by ||
                        !valueSets.sets.paid_by.map(v => v.toLowerCase()).includes(value.toLowerCase())
                    ) {
                        await api.addValueToSet("paid_by", value);
                    }

                    // 4) Végül frissítjük a táblát, hogy megjelenjen az új lenyíló érték
                    await loadSharedExpenses();
                });
            });


            // own_amount mezők figyelése
            document.querySelectorAll(".se-own-amount").forEach(input => {
                input.addEventListener("change", async (e) => {
                    const id = e.target.getAttribute("data-id");
                    let value = e.target.value;

                    // Ha üres -> HIBA, kötelező mező
                    if (value === "" || value === null) {
                        alert("A saját rész mező kötelező (0 is érvényes érték).");
                        e.target.focus();
                        return;
                    }

                    // Konvertáljuk számmá
                    value = Number(value);

                    // Ha nem szám -> nem engedjük tovább
                    if (isNaN(value)) {
                        alert("A saját résznek számnak kell lennie.");
                        e.target.focus();
                        return;
                    }

                    // 0 is teljesen érvényes -> mehet
                    await api.updateSharedExpense(id, "own_amount", value);
                    await loadSharedExpenses();
                });
            });
            // notes mezők figyelése
            document.querySelectorAll(".se-notes").forEach(input => {
                input.addEventListener("change", async (e) => {
                    const id = e.target.getAttribute("data-id");
                    const value = e.target.value.trim();

                    // 1) Mentés backendbe
                    await api.updateSharedExpense(id, "notes", value);

                    // 2) Felület frissítése
                    await loadSharedExpenses();
                });
            });
     

        });
    } 
    catch (err) {
        console.error("Hiba a megosztott költségek betöltésekor:", err);
    }
}
function createInlineSharedExpenseRow() {
    const tbody = document.getElementById("sharedExpensesBody");

    // új sor létrehozása, ami a táblázat tetejére kerül
    const tr = document.createElement("tr");
    tr.classList.add("new-shared-row");

    tr.innerHTML = `
        <td><input type="text" class="se-new-month" placeholder="YYYYMM"></td>
        <td><input type="date" class="se-new-date"></td>
        <td>
            <input list="titlesList" class="se-new-title" placeholder="Megnevezés">
        </td>


        <td><input type="number" step="0.01" class="se-new-amount"></td>

        <!-- paid_by alapértelmezett Zsolti -->
        <td>
            <input type="text" class="se-new-paidby" value="Zsolti">
        </td>

        <td>
            <input type="number" step="1" class="se-new-ownamount" value="0">
        </td>

        <td><input type="text" class="se-new-notes"></td>

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
    // Hónap automatikus kitöltése dátum alapján (modal logika)
    const dateInput = tr.querySelector(".se-new-date");
    const monthInput = tr.querySelector(".se-new-month");

    dateInput.addEventListener("change", () => {
        if (dateInput.value) {
            monthInput.value = deriveMonth(dateInput.value);
        }
    });
}
async function saveNewSharedExpense() {
    const tr = document.querySelector(".new-shared-row");

    const date = tr.querySelector(".se-new-date").value;
    const title = tr.querySelector(".se-new-title").value.trim();
    const amount = Number(tr.querySelector(".se-new-amount").value);
    const paidBy = tr.querySelector(".se-new-paidby").value.trim();
    const ownAmount = Number(tr.querySelector(".se-new-ownamount").value);
    const notes = tr.querySelector(".se-new-notes").value.trim();

    // egyszerű validáció:
    if (!date || !title || isNaN(amount)) {
        alert("Dátum, cím és összeg kötelező.");
        return;
    }

    // a backend API hívást a következő lépésben adjuk hozzá:
    const response = await api.addSharedExpense({
        date,
        title,
        amount,
        paid_by: paidBy,
        own_amount: ownAmount,
        notes
    });

    if (!response || !response.success) {
        alert("Hiba az új megosztott költség mentésekor.");
        return;
    }

    // új betöltés
    await loadSharedExpenses();
    }
