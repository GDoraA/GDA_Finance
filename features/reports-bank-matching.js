window.bankMatchingPageBridge = window.bankMatchingPageBridge || {
    resetPage() {
        // Ebben a release-ben még nincs külön page-state, ezért tudatos no-op.
    },
    load() {
        return loadBankMatchingPage();
    }
};
const bankMatchingIgnoredIds = new Set();

function initBankMatchingStatusFilter() {
    const statusFilterEl = document.getElementById("bankMatchingStatusFilter");
    if (!statusFilterEl || statusFilterEl.dataset.initialized === "1") return;

    statusFilterEl.addEventListener("change", () => {
        loadBankMatchingPage();
    });

    statusFilterEl.dataset.initialized = "1";
}

async function loadBankMatchingPage() {
    initBankMatchingStatusFilter();

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
    const statusFilterEl = document.getElementById("bankMatchingStatusFilter");
    const currentView = String(statusFilterEl?.value || "open").trim().toLowerCase();

    const resp = await api.getBankTransactions();

        if (!resp || resp.success !== true || !Array.isArray(resp.data)) {
            throw new Error(resp?.error || resp?.message || "Hibás banki adatválasz.");
        }

        const bankItems = resp.data;

        const total = bankItems.length;
        let matched = 0;
        let open = 0;
        let ignored = 0;

        bankItems.forEach((item) => {
            const bankId = String(item?.id || "").trim();
            const matchedIds = String(item?.matched_transaction_ids || "").trim();

            const matchStatus = String(item?.match_status || "").trim().toLowerCase();

            if (matchStatus === "ignored" || (bankId && bankMatchingIgnoredIds.has(bankId))) {
                ignored += 1;
            } else if (matchedIds) {
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
                const bankId = String(item?.id || "").trim();
                const matchedIds = String(item?.matched_transaction_ids || "").trim();
                const matchStatus = String(item?.match_status || "").trim().toLowerCase();

                return !matchedIds
                    && matchStatus !== "ignored"
                    && !bankMatchingIgnoredIds.has(bankId);
            });

            const ignoredItems = bankItems.filter((item) => {
                const bankId = String(item?.id || "").trim();
                const matchStatus = String(item?.match_status || "").trim().toLowerCase();

                return matchStatus === "ignored"
                    || (bankId && bankMatchingIgnoredIds.has(bankId));
            });

            const visibleItems = currentView === "ignored"
                ? ignoredItems
                : openItems;

            const emptyMessage = currentView === "ignored"
                ? "Nincs ignored státuszú banki tétel."
                : "Nincs nyitott, párosítatlan banki tétel.";

            if (visibleItems.length === 0) {
                tableBody.innerHTML = `
<tr>
<td colspan="10">${escapeHtml(emptyMessage)}</td>
</tr>
`;
            } else {
                tableBody.innerHTML = visibleItems.map((item) => `
                    <tr>
                        <td>${escapeHtml(String(item?.id || ""))}</td>
                        <td>${escapeHtml(String(item?.month || ""))}</td>
                        <td>${escapeHtml(String(item?.transaction_date || ""))}</td>
                        <td>${escapeHtml(String(item?.posting_date || ""))}</td>
                        <td>${escapeHtml(String(item?.amount || ""))}</td>
                        <td>${escapeHtml(String(item?.direction || ""))}</td>
                        <td>${escapeHtml(String(item?.partner_name || ""))}</td>
                        <td>${escapeHtml(String(item?.memo || ""))}</td>
<td>${currentView === "ignored" ? "Ignored" : "Open"}</td>
<td>
    <button type="button"
            class="${currentView === "ignored" ? "bank-matching-restore-btn" : "bank-matching-ignore-btn"}"
            data-bank-id="${escapeHtml(String(item?.id || ""))}">
        ${currentView === "ignored" ? "Visszaállítás" : "Nem kell párosítani"}
    </button>
</td>
                    </tr>
`).join("");
            }

tableBody.querySelectorAll(".bank-matching-ignore-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
        const bankId = String(btn.dataset.bankId || "").trim();
        if (!bankId) return;

btn.disabled = true;
btn.textContent = "Ignorálás...";

bankMatchingIgnoredIds.add(bankId);
        loadBankMatchingPage();

        try {
            const resp = await api.setBankTransactionMatchStatus(bankId, "ignored");

            if (!resp || resp.success !== true) {
                bankMatchingIgnoredIds.delete(bankId);
                await loadBankMatchingPage();
                alert(resp?.error || resp?.message || "Nem sikerült menteni a státuszt.");
                return;
            }

            await loadBankMatchingPage();
        } catch (err) {
            console.error("Bank matching status save error:", err);
            bankMatchingIgnoredIds.delete(bankId);
            await loadBankMatchingPage();
            alert("Hiba történt a státusz mentésekor.");
        }
    });
});

tableBody.querySelectorAll(".bank-matching-restore-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
        const bankId = String(btn.dataset.bankId || "").trim();
        if (!bankId) return;

btn.disabled = true;
btn.textContent = "Visszaállítás...";

bankMatchingIgnoredIds.delete(bankId);
        loadBankMatchingPage();

        try {
            const resp = await api.setBankTransactionMatchStatus(bankId, "open");

            if (!resp || resp.success !== true) {
                bankMatchingIgnoredIds.add(bankId);
                await loadBankMatchingPage();
                alert(resp?.error || resp?.message || "Nem sikerült visszaállítani a státuszt.");
                return;
            }

            await loadBankMatchingPage();
        } catch (err) {
            console.error("Bank matching status restore error:", err);
            bankMatchingIgnoredIds.add(bankId);
            await loadBankMatchingPage();
            alert("Hiba történt a státusz visszaállításakor.");
        }
    });
});

        }

if (statusEl) {
    statusEl.textContent = currentView === "ignored"
        ? "Ignored nézet betöltve."
        : "Open nézet betöltve.";
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