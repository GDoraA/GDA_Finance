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
        if (!hasPermission("tx_create", "write")) return;

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
function renderStatementItemPicker(tx, bankItems, pickerEl, hiddenInputEl, usedBankIds = new Set()) {
    const currentIds = parseStatementItemIds(tx?.statement_item);
    const currentSet = new Set(currentIds);
    // tx dátum ISO-ra (yyyy-mm-dd)
    const rawTxDate = String(tx?.date ?? "").trim();
    const txDateIso = rawTxDate.includes("T") ? rawTxDate.split("T")[0] : toInputDateLocal(rawTxDate);
    // 1) első kör: dátum + összeg alapján egyezők
    let matches = window.transactionsPageBridge?.getMatchingBankItems
        ? window.transactionsPageBridge.getMatchingBankItems(tx, bankItems)
        : getMatchingBankItems(tx, bankItems);  // 1/a) szűrés: ne jelenjen meg olyan banki tétel, ami már máshoz van társítva
    matches = (matches || []).filter(b => {
        const bid = String(b?.id ?? "").trim();
        if (!bid) return false;
        if (currentSet.has(bid)) return true; // a jelenlegi(ek) maradhat(nak)
        return !usedBankIds.has(bid);
    });
    // 2) fallback: ha nincs egyező összeg, akkor az adott napi "szabad" banki tételek
    let isFallback = false;
    if (!matches.length) {
        isFallback = true;
        matches = (bankItems || []).filter(b => {
            const bid = String(b?.id ?? "").trim();
            if (!bid) return false;
            const bDateIso = String(b?.transaction_date ?? "").trim();
            if (!txDateIso || !bDateIso) return false;
            if (bDateIso !== txDateIso) return false;
            if (currentSet.has(bid)) return true;
            return !usedBankIds.has(bid);
        });
    }
    // Ha már volt korábban kiválasztott statement_item, azt mindig mutassuk meg,
    // akkor is, ha sem az összeg-egyezésbe, sem a fallback (adott napi szabad) listába nem kerülne be.
    if (currentIds.length) {
        const have = new Set((matches || []).map(b => String(b?.id ?? "").trim()).filter(Boolean));
        const missing = currentIds.filter(id => !have.has(id));
        if (missing.length) {
            const extras = (bankItems || []).filter(b => missing.includes(String(b?.id ?? "").trim()));
            if (extras.length) {
                matches = [...extras, ...(matches || [])];
            }
        }
    }
    if (!matches.length) {
        pickerEl.innerHTML = `<div class="muted">Nincs választható banki tétel (sem egyező összeggel, sem az adott napon szabadon).</div>`;
        return;
    }
    const esc = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const pickField = (obj, keys) => {
        for (const k of keys) {
            const v = obj?.[k];
            if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
        }
        return "";
    };
    const info = isFallback
        ? `<div class="muted" style="margin-bottom:4px;">
              <span style="font-size:11px;opacity:.75;">fallback</span>
           </div>`
        : "";
    // fallback esetén: a legközelebbi összeg legyen elöl
    // (ha nem fallback, a meglévő "matches" sorrendet megtartjuk)
    if (isFallback) {
        const txAmt = Number(tx?.amount ?? 0);
        matches = (matches || []).slice().sort((a, b) => {
            const da = Math.abs(Number(a?.amount ?? 0) - txAmt);
            const db = Math.abs(Number(b?.amount ?? 0) - txAmt);
            return da - db;
        });
    }
    const amountById = new Map();
    const rows = matches.map(b => {
        const id = String(b?.id ?? "").trim();
        const date = String(b?.transaction_date ?? "").trim();
        const amt = formatAmount(b?.amount);
        const rawN = normalizeAmount(b?.amount);
        const n = (typeof rawN === "number") ? rawN : (Number(b?.amount ?? 0) || 0);
        amountById.set(id, n);
        const checked = currentSet.has(id) ? "checked" : "";
        // több mező – többféle lehetséges oszlopnév támogatása
        const counterparty = pickField(b, ["partner_name", "counterparty_name", "name", "beneficiary", "payer"]);
        const account = pickField(b, ["partner_account", "counterparty_account", "account", "iban"]);
        const memo = pickField(b, ["memo", "comment", "description", "text", "note", "transaction_text"]);
        const direction = pickField(b, ["direction", "transaction_type", "type"]);
        const currentBadge = currentSet.has(id)
            ? `<span style="margin-left:6px;font-size:11px;opacity:.75;">jelenlegi</span>`
            : "";
        const line1 = `<span class="statement-item-id">#${esc(id)}</span>${currentBadge}
                   <span class="statement-item-date">${esc(date)}</span>
                   <span class="statement-item-amt">${esc(amt)}</span>`;
        const line2Parts = [
            counterparty ? `<span class="statement-item-party">${esc(counterparty)}</span>` : "",
            memo ? `<span class="statement-item-memo">${esc(memo)}</span>` : ""
        ].filter(Boolean).join(" — ");
        const line3Parts = [
            direction ? `<span class="statement-item-dir">${esc(direction)}</span>` : "",
            account ? `<span class="statement-item-acct">${esc(account)}</span>` : ""
        ].filter(Boolean).join(" · ");
        return `
      <label class="statement-item-row">
        <input class="statement-item-check" type="checkbox" name="statement_item_pick" value="${esc(id)}" ${checked}>
        <span class="statement-item-content">
          <span class="statement-item-top">${line1}</span>
          ${line2Parts ? `<span class="statement-item-sub">${line2Parts}</span>` : ""}
          ${line3Parts ? `<span class="statement-item-sub2">${line3Parts}</span>` : ""}
        </span>
      </label>
    `;
    }).join("");
    pickerEl.innerHTML = info + rows;
    const syncHiddenFromChecks = () => {
        const ids = Array.from(pickerEl.querySelectorAll("input[type='checkbox'][name='statement_item_pick']:checked"))
            .map(el => String(el.value || "").trim())
            .filter(Boolean);
        hiddenInputEl.value = ids.join(", ");
        const sumEl = document.getElementById("statementItemSelectedSum");
        if (sumEl) {
            const total = ids.reduce((acc, id) => acc + (amountById.get(id) || 0), 0);
            sumEl.textContent = formatAmount(total);
        }
    };
    // induláskor is normalizáljuk (pl. "1,2" -> "1, 2")
    syncHiddenFromChecks();
    pickerEl.querySelectorAll("input[type='checkbox'][name='statement_item_pick']").forEach(ch => {
        ch.addEventListener("change", () => {
            syncHiddenFromChecks();
        });
    });
}
async function openTransactionEditor(tx) {
    if (!hasPermission("tx_update", "write")) return;

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
            if (!Array.isArray(window.transactionsPageBridge?.getCache?.() || transactionsCache)) {
                try {
                    if (window.transactionsPageBridge?.ensureCache) {
                        await window.transactionsPageBridge.ensureCache();
                    } else {
                        const r = await api.getTransactions();
                        if (!r || !r.success || !Array.isArray(r.data)) {
                            throw new Error(
                                r?.error || r?.message || "Nem sikerült betölteni a tranzakciókat."
                            );
                        }
                        transactionsCache = r.data;
                    }

                    if (!r || !r.success) {
                        console.warn(
                            "getTransactions unsuccessful response in openTransactionEditor:",
                            r?.error || r?.message || r
                        );
                        transactionsCache = [];
                    } else {
                        transactionsCache = Array.isArray(r.data) ? r.data : [];
                    }
                } catch (err) {
                    console.error("getTransactions failed in openTransactionEditor:", err);
                    transactionsCache = [];
                }
            }
            const bankItems = await ensureBankTxCache();
            const txCache = window.transactionsPageBridge?.getCache?.() || transactionsCache || [];
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
    if (delBtn) delBtn.style.display = hasPermission("tx_delete", "write") ? "inline-block" : "none";
    if (copyBtn) copyBtn.style.display = hasPermission("tx_create", "write") ? "inline-block" : "none";
    // modal megnyitása
    modal.classList.add("open");
    overlay.classList.add("open");
}
// Tranzakció törlése modalból
document.getElementById("txDeleteBtn")?.addEventListener("click", async (event) => {
    if (!hasPermission("tx_delete", "write")) return;

    const deleteBtn = event.currentTarget;
    const form = document.getElementById("txForm");
    const txId = form?.getAttribute("data-edit-id");

    if (!txId) return;
    if (deleteBtn?.disabled) return;

    const ok = confirm("Biztosan törlöd ezt a tranzakciót? A kapcsolódó tételek is törlődhetnek.");
    if (!ok) return;

    if (deleteBtn) deleteBtn.disabled = true;

    try {
        const resp = await api.deleteTransaction(txId);

        if (!resp || !resp.success) {
            console.warn(
                "deleteTransaction unsuccessful response:",
                resp?.error || resp?.message || resp
            );
            alert(resp?.error || resp?.message || "A törlés nem sikerült.");
            return;
        }

        document.getElementById("txModal")?.classList.remove("open");
        document.getElementById("modalOverlay")?.classList.remove("open");
        await loadTransactions(true);
    } catch (err) {
        console.error("deleteTransaction error:", err);
        alert("Váratlan hiba történt a törlés során.");
    } finally {
        if (deleteBtn) deleteBtn.disabled = false;
    }
});
// Tranzakció másolása (date + month nélkül)
document.getElementById("txCopyBtn")?.addEventListener("click", () => {
    if (!hasPermission("tx_create", "write")) return;

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
    if (copyBtn) copyBtn.style.display = hasPermission("tx_create", "write") ? "inline-block" : "none";
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
