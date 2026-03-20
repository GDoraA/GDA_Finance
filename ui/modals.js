const modal = document.getElementById("txModal");
const overlay = document.getElementById("modalOverlay");
const openBtn = document.getElementById("openModalBtn");
const closeBtn = document.getElementById("closeModalBtn");
// ===== MODAL =====
function hideTxModalMessages() {
    const s = document.getElementById("successMsg");
    const e = document.getElementById("errorMsg");
    if (s) s.style.display = "none";
    if (e) e.style.display = "none";
}
if (openBtn && modal && overlay) {
    openBtn.addEventListener("click", () => {
        const form = document.getElementById("txForm");
        if (form) {
            form.reset();
            form.removeAttribute("data-edit-id");
            const delBtn = document.getElementById("txDeleteBtn");
            const copyBtn = document.getElementById("txCopyBtn");
            if (delBtn) delBtn.style.display = "none";
            if (copyBtn) copyBtn.style.display = "none";
        }
        modal.classList.add("open");
        overlay.classList.add("open");
    });
}
if (closeBtn && modal && overlay) {
    closeBtn.addEventListener("click", () => {
        modal.classList.remove("open");
        overlay.classList.remove("open");
    });
}
async function openTransactionEditor(tx) {
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
    // statement_item dropdown (Bank_Transactions date+amount alapján)
    // statement_item választólista (Bank_Transactions date+amount alapján)
    const picker = document.getElementById("statementItemPicker");
    const hidden = document.getElementById("statementItemValue");
    if (hidden) hidden.value = String(tx?.statement_item ?? "").trim();
    if (picker && hidden) {
        try {
            // biztos legyen friss transactionsCache (kell a "már használt banki tételek" szűréshez)
            if (!Array.isArray(transactionsCache)) {
                try {
                    const r = await api.getTransactions();
                    transactionsCache = (r && r.success && Array.isArray(r.data)) ? r.data : [];
                } catch (_) {
                    transactionsCache = [];
                }
            }
            const bankItems = await ensureBankTxCache();
            // már használt banki tételek (statement_item alapján)
            // statement_item mostantól lehet: "12, 18, 25" (több banki tétel egy tranzakcióhoz)
            const usedBankIds = new Set(
                (transactionsCache || [])
                    .flatMap(t => parseStatementItemIds(t?.statement_item))
            );
            // a jelenlegi tx saját korábbi értékeit engedjük (ne tűnjenek el a listából)
            const currentStmtIds = parseStatementItemIds(tx?.statement_item);
            currentStmtIds.forEach(id => usedBankIds.delete(id));
            // +1 paraméter: usedBankIds (a függvény a következő lépésben fogja használni)
            renderStatementItemPicker(tx, bankItems, picker, hidden, usedBankIds);
        } catch (e) {
            console.error("Bank_Transactions cache betöltés hiba:", e);
            picker.innerHTML = `<div class="muted">Nem sikerült betölteni a banki tételeket.</div>`;
        }
    }
    // a szerkesztendő ID-t eltároljuk a formban (nem látszik, de szükséges)
    document.getElementById("txForm").setAttribute("data-edit-id", tx.id);
    // Szerkesztés módban a Törlés + Másolás gomb látszódjon
    const delBtn = document.getElementById("txDeleteBtn");
    const copyBtn = document.getElementById("txCopyBtn");
    if (delBtn) delBtn.style.display = "inline-block";
    if (copyBtn) copyBtn.style.display = "inline-block";
    // modal megnyitása
    modal.classList.add("open");
    overlay.classList.add("open");
}
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
        await loadTransactions(true);
    } catch (err) {
        console.error("deleteTransaction error:", err);
        alert("Váratlan hiba történt a törlés során.");
    }
});
// Tranzakció másolása (date + month nélkül)
document.getElementById("txCopyBtn")?.addEventListener("click", () => {
    const form = document.getElementById("txForm");
    if (!form) return;
    // Csak a dátum + hónap ürül, minden más marad
    const dateEl = form.querySelector("input[name='date']");
    const monthEl = form.querySelector("input[name='month']");
    if (dateEl) dateEl.value = "";
    if (monthEl) monthEl.value = "";
    // ÚJ rekord lesz (ne módosítson)
    form.removeAttribute("data-edit-id");
    const submitBtn = form.querySelector("button[type='submit'], #txSubmitBtn");
    if (submitBtn) submitBtn.textContent = "Mentés";
    // Törlés gomb ne látszódjon új rekordnál
    const delBtn = document.getElementById("txDeleteBtn");
    if (delBtn) delBtn.style.display = "none";
    // Másolás gomb maradhat elérhető (ha egymás után több másolat kell)
    const copyBtn = document.getElementById("txCopyBtn");
    if (copyBtn) copyBtn.style.display = "inline-block";
    // Fókusz az új dátum mezőre
    if (dateEl) {
        dateEl.focus();
        // ha supported, nyissa meg a date pickert
        if (typeof dateEl.showPicker === "function") {
            try { dateEl.showPicker(); } catch (e) { }
        }
    }
    // Ha van olyan logikád, ami dátumból számolja a hónapot,
    // itt érdemes meghívni/triggerelni (különben marad üres és a user tölti).
    if (dateEl && monthEl) {
        // ha a month valahol change-re/blur-re számolódik, ezt triggereljük
        dateEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
});