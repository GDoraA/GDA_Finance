// -----------------------------------------------------------------------------
// GDA Finance – Frontend alkalmazás logika (magyar kommentekkel)
// app.js
// -----------------------------------------------------------------------------
//
// Ez a fájl kezeli:
//   • a tranzakció rögzítési űrlapot
//   • az objektum létrehozását (id, month, created_at)
//   • a tranzakció sor megjelenítését
//   • a backend (Google Apps Script) meghívását
//
// A modul a következő külső fájlokat használja:
//   • utils/helpers.js  → idGenerator, extractMonth, getTimestamp
//   • scripts/api.js    → saveTransaction(), fetchTransactions()
// -----------------------------------------------------------------------------

// HTML elemek beolvasása
const form = document.getElementById("transaction-form");
const tableBody = document.querySelector(".table tbody");

// -----------------------------------------------------------------------------
// ESEMÉNY: Űrlap elküldése
// -----------------------------------------------------------------------------

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Form értékeinek kiolvasása
    const formData = new FormData(form);

    const date = formData.get("date");
    const amount = parseFloat(formData.get("amount") || 0);
    const title = formData.get("title");
    const category = formData.get("category");
    const payment_type = formData.get("payment_type");
    const transaction_type = formData.get("transaction_type");
    const is_shared = formData.get("is_shared") === "on";
    const statement_item = formData.get("statement_item");
    const created_by = formData.get("created_by");

    // -------------------------------------------------------------------------
    // TRANZAKCIÓ OBJEKTUM FELÉPÍTÉSE
    // -------------------------------------------------------------------------

    const transaction = {
        id: generateId(),            // helpers.js
        month: extractMonth(date),   // helpers.js
        date,
        amount,
        title,
        category,
        payment_type,
        transaction_type,
        is_shared,
        statement_item: statement_item || "",
        created_by,
        created_at: getTimestamp()   // helpers.js
    };

    // -------------------------------------------------------------------------
    // TRanzakció megjelenítése a táblázatban (frontend)
    // -------------------------------------------------------------------------

    appendTransactionToTable(transaction);

    // -------------------------------------------------------------------------
    // Mentés Google Sheets-be (backend)
    // api.js → saveTransaction()
    // -------------------------------------------------------------------------

    try {
        if (typeof saveTransaction === "function") {
            await saveTransaction(transaction);
            console.log("Tranzakció mentve a backendbe.");
        } else {
            console.warn("saveTransaction() még nincs definiálva. (api.js hiányzik?)");
        }
    } catch (err) {
        console.error("Hiba a mentés során:", err);
        alert("Hiba történt a mentés során.");
    }

    // Űrlap ürítése
    form.reset();
});

// -----------------------------------------------------------------------------
// MEGJELENÍTÉS: Új sor hozzáadása a táblázathoz
// -----------------------------------------------------------------------------

function appendTransactionToTable(t) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.title}</td>
        <td>${t.category}</td>
        <td class="${t.amount < 0 ? "table__cell--negative" : "table__cell--positive"}">
            ${t.amount}
        </td>
        <td>${t.transaction_type}</td>
        <td>${t.payment_type}</td>
        <td>${t.is_shared ? "Igen" : "Nem"}</td>
    `;

    // Legújabb legyen legfelül
    tableBody.prepend(tr);
}

// -----------------------------------------------------------------------------
// KÉSŐBBI BŐVÍTÉSEK:
//
//   • fetchTransactions() → API-ból betöltés induláskor
//   • deleteTransaction() → sor törlése
//   • updateTransaction() → módosítás támogatása
//
// A jelenlegi verzió a minimális működést biztosítja.
// -----------------------------------------------------------------------------
