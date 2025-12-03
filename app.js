document.addEventListener("DOMContentLoaded", async () => {

    loadTransactionList();

    document.getElementById("add-transaction-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const item = {
            month: getMonthString(document.getElementById("date").value),
            date: document.getElementById("date").value,
            amount: document.getElementById("amount").value,
            title: document.getElementById("title").value,
            category: document.getElementById("category").value,
            payment_type: document.getElementById("payment_type").value,
            transaction_type: document.getElementById("transaction_type").value,
            is_shared: document.getElementById("is_shared").checked ? "true" : "false",
            statement_item: document.getElementById("statement_item").value,
            created_by: "dori",
            created_at: getTimestamp()
        };

        const result = await api.addItem(item);

        if (result.success) {
            alert("Mentve!");
            loadTransactionList();
            e.target.reset();
        } else {
            alert("Hiba: " + (result.error || "Ismeretlen hiba"));
        }
    });
});

async function loadTransactionList() {
    const container = document.getElementById("transaction-list");
    container.innerHTML = "Betöltés...";

    const list = await api.getList();

    container.innerHTML = "";

    if (!list.success || !list.items) {
        container.innerHTML = "<p>Hiba a lista betöltésekor.</p>";
        return;
    }

    list.items.forEach(item => {
        const div = document.createElement("div");
        div.className = "transaction-item";

        div.innerHTML = `
            <strong>${item.title}</strong> – ${item.amount} Ft<br>
            <small>${item.date} • ${item.category} • ${item.payment_type}</small>
        `;

        container.appendChild(div);
    });
}
