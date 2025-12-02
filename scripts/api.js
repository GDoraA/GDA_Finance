/* --------------------------------------------------------------------------
   GDA Finance – API modul (magyar kommentekkel)
   --------------------------------------------------------------------------
   Ez a modul kezeli a kommunikációt a Google Apps Script backend és a PWA között.
   - saveTransaction(data)   → új tranzakció mentése
   - fetchTransactions()     → tranzakciók lekérése
-------------------------------------------------------------------------- */

// A backend Web App URL-je (ezt a saját GAS alkalmazásod URL-jére kell cserélned!)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbz1IEJ0bKLVz6XodyvJtgs1CiWsSwKKYsAzK7e8PjacewWiDfA4t-PubTjEMx3i1A/exec";

/* --------------------------------------------------------------------------
   Új tranzakció mentése a Google Sheetbe
-------------------------------------------------------------------------- */
async function saveTransaction(data) {
    const payload = {
        table: "Transactions",
        data: data
    };

    const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status !== "success") {
        throw new Error("Hiba a tranzakció mentése során: " + JSON.stringify(result));
    }

    return result;
}

/* --------------------------------------------------------------------------
   Tranzakciók lekérése
-------------------------------------------------------------------------- */
async function fetchTransactions() {
    const url = BACKEND_URL + "?table=Transactions";

    const response = await fetch(url);
    const result = await response.json();

    if (result.status !== "success") {
        throw new Error("Hiba a tranzakciók lekérése során: " + JSON.stringify(result));
    }

    return result.data.rows;
}

/* --------------------------------------------------------------------------
   További API műveletek később:
   - updateTransaction()
   - deleteTransaction()
   - fetchSharedExpenses()
   - saveSharedExpense()
-------------------------------------------------------------------------- */
