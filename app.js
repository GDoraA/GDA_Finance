// ------------------ DOM READY ------------------
document.addEventListener("DOMContentLoaded", () => {

    const dateInput = document.querySelector("input[name='date']");
    const monthInput = document.querySelector("input[name='month']");
    const amountInput = document.querySelector("input[name='amount']");

    // --- Automatikus month kitöltés ---
    dateInput.addEventListener("change", () => {
        if (!dateInput.value) return;
        monthInput.value = deriveMonth(dateInput.value);
    });

    // --- Amount valós idejű normalizálás ---
    amountInput.addEventListener("input", () => {
        amountInput.value = normalizeAmount(amountInput.value);
    });

    // --- Submit ---
    document.getElementById("txForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = Object.fromEntries(new FormData(e.target).entries());

        // dátum normalizálás
        formData.date = formatDateHU(formData.date);

        // amount normalizálás
        formData.amount = normalizeAmount(formData.amount);

        const successMsg = document.getElementById("successMsg");
        const errorMsg = document.getElementById("errorMsg");
        successMsg.style.display = "none";
        errorMsg.style.display = "none";

        try {
            const result = await api.addTransaction(formData);

            if (result && result.success) {
                successMsg.style.display = "block";
                e.target.reset();
            } else {
                errorMsg.style.display = "block";
            }
        } catch(err) {
            errorMsg.style.display = "block";
        }
    });

    // --- Listázás ---
    document.getElementById("loadListBtn").addEventListener("click", loadTransactions);
});


// ------------------ LISTA BETÖLTÉSE ------------------
async function loadTransactions() {

    const result = await api.getTransactions();
    const list = document.getElementById("transactionsList");

    if (!result || !result.success) {
        list.innerHTML = "Hiba a betöltéskor.";
        return;
    }

    const data = result.data;

    // szűrő értékek
    const fMonth = document.getElementById("filterMonth").value.trim();
    const fCat   = document.getElementById("filterCategory").value.trim().toLowerCase();
    const fType  = document.getElementById("filterType").value;
    const fTitle = document.getElementById("filterTitle").value.trim().toLowerCase();

    const filtered = data.filter(tx => {
        if (fMonth && String(tx.month) !== fMonth) return false;
        if (fCat   && !String(tx.category).toLowerCase().includes(fCat)) return false;
        if (fType  && tx.transaction_type !== fType) return false;
        if (fTitle && !String(tx.title).toLowerCase().includes(fTitle)) return false;
        return true;
    });

    let html = "";
    filtered.forEach(tx => {
        html += `
          <div class="tx-item">
            <div><strong>${tx.title}</strong> (${tx.amount})</div>
            <div>${tx.date} • ${tx.category} • ${tx.transaction_type}</div>
            <div class="tx-id">ID: ${tx.id}</div>
          </div>
        `;
    });

    list.innerHTML = html || "Nincs megjeleníthető adat.";
}
