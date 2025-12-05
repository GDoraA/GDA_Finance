document.addEventListener("DOMContentLoaded", () => {
    // ===== MODAL KEZELÉSE =====
    const modal = document.getElementById("txModal");
    const overlay = document.getElementById("modalOverlay");
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");

    openBtn.addEventListener("click", () => {
        modal.classList.add("open");
        overlay.classList.add("open");
    });

    closeBtn.addEventListener("click", () => {
        modal.classList.remove("open");
        overlay.classList.remove("open");
    });

    // --- Dátum → hónap automatikus generálás ---
    const dateInput = document.querySelector("input[name='date']");
    const monthInput = document.querySelector("input[name='month']");

    dateInput.addEventListener("change", () => {
        if (dateInput.value) {
            monthInput.value = deriveMonth(dateInput.value);
        }
    });

    // --- Dropdown értékek betöltése a datalist-ekbe ---
    loadDropdownValues();


    // --- Mentés ---
    document.getElementById("txForm").addEventListener("submit", async e => {
        e.preventDefault();

        const form = new FormData(e.target);
        const formData = Object.fromEntries(form.entries());

        // Dátum magyar formátumba
        formData.date = formatDateHU(formData.date);

        const s = document.getElementById("successMsg");
        const er = document.getElementById("errorMsg");

        s.style.display = "none";
        er.style.display = "none";

        try {
            const result = await api.addTransaction(formData);
            if (result && result.success) {
                s.style.display = "block";
                e.target.reset();
                loadDropdownValues(); // új érték → frissítjük a datalist-et
            } else {
                er.style.display = "block";
            }
        } catch (err) {
            er.style.display = "block";
            console.error(err);
        }
    });
    if (result && result.success) {
    s.style.display = "block";
    e.target.reset();

    loadDropdownValues();

    // modal bezárása mentés után
    modal.classList.remove("open");
    overlay.classList.remove("open");
}

    // --- Lista betöltése ---
    document.getElementById("loadListBtn").addEventListener("click", loadTransactions);
});



// ======================================================
// DATALIST ÉRTÉKEK BETÖLTÉSE
// ======================================================

async function loadDropdownValues() {
    const result = await api.getValueSets();
    if (!result || !result.success) return;

    const sets = result.sets;

    fillDatalist("titlesList", sets.titles);
    fillDatalist("categoriesList", sets.categories);
    fillDatalist("paymentTypesList", sets.payments);
    fillDatalist("transactionTypesList", sets.types);
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
        tbody.innerHTML = `
            <tr><td colspan="6">Hiba a betöltéskor.</td></tr>
        `;
        return;
    }

    const data = result.data;

    const fMonth = document.getElementById("filterMonth").value.trim();
    const fCategory = document.getElementById("filterCategory").value.trim().toLowerCase();
    const fType = document.getElementById("filterType").value;
    const fTitle = document.getElementById("filterTitle").value.trim().toLowerCase();

    const filtered = data.filter(tx => {
        if (fMonth && String(tx.month) !== fMonth) return false;
        if (fCategory && !String(tx.category).toLowerCase().includes(fCategory)) return false;
        if (fType && tx.transaction_type !== fType) return false;
        if (fTitle && !String(tx.title).toLowerCase().includes(fTitle)) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">Nincs megjeleníthető adat.</td></tr>
        `;
        return;
    }

    let rows = "";

    filtered.forEach(tx => {
        rows += `
            <tr>
                <td>${tx.date}</td>
                <td>${tx.title}</td>
                <td>${tx.category}</td>
                <td>${tx.transaction_type}</td>
                <td>${tx.amount}</td>
                <td class="tx-id">${tx.id}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

