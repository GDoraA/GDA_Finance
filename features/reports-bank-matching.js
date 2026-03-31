window.bankMatchingPageBridge = window.bankMatchingPageBridge || {
    resetPage() {
        // Ebben a release-ben még nincs külön page-state, ezért tudatos no-op.
    },
    load() {
        return loadBankMatchingPage();
    }
};

async function loadBankMatchingPage() {
    const pageEl = document.getElementById("page-bank-matching");
    if (!pageEl) return;

    const statusEl = pageEl.querySelector("[data-bank-matching-status]");
    if (statusEl) {
        statusEl.textContent = "Adatok betöltése...";
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    try {
        const resp = await api.getBankTransactions();

        if (!resp || resp.success !== true || !Array.isArray(resp.data)) {
            throw new Error(resp?.error || resp?.message || "Hibás banki adatválasz.");
        }

        const bankItems = resp.data;

        const total = bankItems.length;

        let matched = 0;
        let open = 0;
        const ignored = 0; // match_status még nincs bevezetve ebben a release-ben

        bankItems.forEach((item) => {
            const matchedIds = String(item?.matched_transaction_ids || "").trim();
            if (matchedIds) {
                matched += 1;
            } else {
                open += 1;
            }
        });

        const denominator = total - ignored;
        const ratio = denominator > 0
            ? Math.round((matched / denominator) * 100)
            : 0;

        setText("bankMatchingTotal", total);
        setText("bankMatchingMatched", matched);
        setText("bankMatchingOpen", open);
        setText("bankMatchingIgnored", ignored);
        setText("bankMatchingRatio", `${ratio}%`);

        const tableBody = document.getElementById("bankMatchingTableBody");
        if (tableBody) {
            const openItems = bankItems.filter((item) => {
                const matchedIds = String(item?.matched_transaction_ids || "").trim();
                return !matchedIds;
            });

            if (openItems.length === 0) {
                tableBody.innerHTML = `
            <tr>
<td colspan="10">Nincs megjeleníthető adat.</td>
            </tr>
        `;
            } else {
                tableBody.innerHTML = openItems.map((item) => `
                    <tr>
                        <td>${escapeHtml(String(item?.id || ""))}</td>
                        <td>${escapeHtml(String(item?.month || ""))}</td>
                        <td>${escapeHtml(String(item?.transaction_date || ""))}</td>
                        <td>${escapeHtml(String(item?.posting_date || ""))}</td>
                        <td>${escapeHtml(String(item?.amount || ""))}</td>
                        <td>${escapeHtml(String(item?.direction || ""))}</td>
                        <td>${escapeHtml(String(item?.partner_name || ""))}</td>
                        <td>${escapeHtml(String(item?.memo || ""))}</td>
                        <td>Open</td>
                        <td>
                            <button type="button">Nem kell párosítani</button>
                        </td>
                    </tr>
`).join("");
            }
        }

        if (statusEl) {
            statusEl.textContent = "Riport betöltve.";
        }
    } catch (err) {
        console.error("Bank matching load error:", err);

        setText("bankMatchingTotal", 0);
        setText("bankMatchingMatched", 0);
        setText("bankMatchingOpen", 0);
        setText("bankMatchingIgnored", 0);
        setText("bankMatchingRatio", "0%");

        if (statusEl) {
            statusEl.textContent = "Hiba a banki adatok betöltésekor.";
        }
    }
}