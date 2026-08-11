window.sharedExpensesPageBridge = window.sharedExpensesPageBridge || {
    resetPage() {
        // Jelenleg nincs külön shared page számláló/state, ezért ez tudatos no-op.
        // Az interfész-egységesség miatt mégis része a bridge-nek.
    },
    load() {
        return loadSharedExpenses();
    }
};
function renderSharedLoadError(tbody, colspan, errorLike, fallbackMessage) {
    const message =
        errorLike?.error ||
        errorLike?.message ||
        fallbackMessage ||
        "Hiba a megosztott költségek betöltésekor.";

    if (errorLike instanceof Error) {
        console.error("Shared expenses load error:", errorLike);
    } else if (errorLike) {
        console.warn("Shared expenses unsuccessful response:", errorLike);
    }

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
    }
}

function formatSharedRecordEffect(effect) {
    if (!effect || effect.kind === "none") return "Nincs egyenleghatás";
    const amount = `${formatAmount(effect.amount)} Ft`;
    if (effect.kind === "settlement") return `Zsolti tartozása −${amount}`;
    if (effect.kind === "zsolti-debt") return `Zsolti tartozása +${amount}`;
    if (effect.kind === "dori-debt") return `Dóri tartozása +${amount}`;
    return "Nincs egyenleghatás";
}

function getSharedEffectClass(effect) {
    if (!effect) return "effect-none";
    return `effect-${effect.kind}`;
}

function formatSharedRunningBalance(net) {
    if (net > 0) return `Dóri tartozik Zsoltinak ${formatAmount(net)} Ft`;
    if (net < 0) return `Zsolti tartozik Dórinak ${formatAmount(Math.abs(net))} Ft`;
    return "Kiegyenlített";
}

function getSharedRunningBalanceClass(net) {
    if (net !== 0) return "shared-running-balance";
    return "shared-running-balance is-zero";
}

async function loadSharedExpenses() {
    try {
        // ===== SORT ICONS RESET (SHARED EXPENSES) =====
        document.querySelectorAll("#sharedExpensesTable thead th[data-sort]").forEach(th => {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === seSortField) {
                th.classList.add(seSortDirection === "asc" ? "sort-asc" : "sort-desc");
            }
        });

        const tbody = document.getElementById("sharedExpensesBody");
        if (!tbody) return;

        let result;
        try {
            result = await api.getSharedExpenses();
        } catch (err) {
            renderSharedLoadError(
                tbody,
                14,
                err,
                "Hiba a megosztott költségek betöltésekor."
            );
            return;
        }

        let valueSetsResponse;
        try {
            valueSetsResponse = await api.getValueSets();
        } catch (err) {
            renderSharedLoadError(
                tbody,
                14,
                err,
                "Hiba a segédlisták betöltésekor."
            );
            return;
        }

        if (!result || !result.success) {
            renderSharedLoadError(
                tbody,
                14,
                result,
                "Hiba a megosztott költségek betöltésekor."
            );
            return;
        }

        if (!valueSetsResponse || !valueSetsResponse.success) {
            renderSharedLoadError(
                tbody,
                14,
                valueSetsResponse,
                "Hiba a segédlisták betöltésekor."
            );
            return;
        }

        const valueSets = valueSetsResponse.sets || {};
        tbody.innerHTML = "";
        seRowsById = new Map();
        const sharedRows = Array.isArray(result.data) ? result.data : [];
        const runningBalances = window.sharedExpenseRunningBalance.calculate(sharedRows);
        // ===== DÁTUM SZERINTI RENDEZÉS (ÚJ FELÜL) =====
        // 1) Rendezés: legrégebbi → legújabb
        // ===== RENDEZÉS (fejlécre kattintás alapján) =====
        const seDir = (seSortDirection === "asc") ? 1 : -1;
        const seToNum = (v) => {
            const n = Number(String(v ?? "").replace(/\s+/g, "").replace(",", "."));
            return isNaN(n) ? null : n;
        };
        const seToTime = (v) => {
            const t = new Date(v).getTime();
            return isNaN(t) ? null : t;
        };
        sharedRows.sort((a, b) => {
            const va = a?.[seSortField];
            const vb = b?.[seSortField];
            // null/undefined a végére
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            // szám mezők
            const numFields = new Set([
                "amount",
                "Zsolti_amount",
                "Dori_amount",
                "remaining_amount",
                "Zsolti_balance",
                "Dori_balance",
                "balance_impact"
            ]);
            if (numFields.has(seSortField)) {
                const na = seToNum(va);
                const nb = seToNum(vb);
                if (na == null && nb == null) return 0;
                if (na == null) return 1;
                if (nb == null) return -1;
                return (na - nb) * seDir;
            }
            // dátum mező
            if (seSortField === "date") {
                const ta = seToTime(va);
                const tb = seToTime(vb);
                if (ta == null && tb == null) return 0;
                if (ta == null) return 1;
                if (tb == null) return -1;
                return (ta - tb) * seDir;
            }
            // minden más: szöveg
            const sa = String(va).toLowerCase();
            const sb = String(vb).toLowerCase();
            return sa.localeCompare(sb, "hu") * seDir;
        });
        // ====== EGYENLEG SZÁMÍTÁSA (PIROS - KÉK + LILA) ======
        let blueTotal = 0;    // kék: Zsolti tartozása (paid_by = Dóri)
        let redTotal = 0;    // piros: Dóri tartozása  (paid_by = Zsolti)
        let purpleTotal = 0;  // lila: törlesztés tételek összege
        const isSettlementRow = window.sharedExpenseRunningBalance.isSettlement;
        for (const row of sharedRows) {
            const paidBy = String(row.paid_by || "").trim().toLowerCase();
            if (isSettlementRow(row)) {
                purpleTotal += Math.abs(Number(row.amount) || 0);
                continue;
            }
            if (paidBy === "dóri" || paidBy === "dori") {
                blueTotal += Math.abs(Number(row.Zsolti_balance) || 0);
            } else if (paidBy === "zsolti") {
                redTotal += Math.abs(Number(row.Dori_balance) || 0);
            }
        }
        const headerNet = runningBalances.finalNet;
        // ====== EGYENLEG KIÍRÁSA A FEJLÉC ALATTI DOBOZBA ======
        const box = document.getElementById("sharedBalanceValue");
        const label = document.getElementById("sharedBalanceLabel");
        // ====== RÉSZÖSSZEGEK KIÍRÁSA (KÉK / PIROS / TÖRLESZTÉS) ======
        const blueEl = document.getElementById("sharedBlueTotal");
        const redEl = document.getElementById("sharedRedTotal");
        const purpleEl = document.getElementById("sharedPurpleTotal");
        if (blueEl) blueEl.textContent = formatAmount(blueTotal);
        if (redEl) redEl.textContent = formatAmount(redTotal);
        if (purpleEl) purpleEl.textContent = formatAmount(purpleTotal);
        // A HTML-ben ezek az ID-k léteznek:contentReference[oaicite:2]{index=2}
        if (box) box.textContent = `${formatSignedAmount(headerNet)} Ft`;
        if (label) {
            if (headerNet > 0) {
                label.textContent = " — Dóri tartozása";
                label.className = "balance-negative"; // nálad ez a piros stílus
            } else if (headerNet < 0) {
                label.textContent = " — Zsolti tartozása";
                label.className = "balance-positive"; // nálad ez a kék stílus
            } else {
                label.textContent = " — Az elszámolás kiegyenlített";
                label.className = "";
            }
        }
        sharedRows.forEach(row => {
            const tr = document.createElement("tr");
            seRowsById.set(String(row.id), row);
            tr.setAttribute("data-id", row.id);
            const running = runningBalances.byRow.get(row) || {
                effect: { kind: "none", amount: 0 },
                net: 0,
                doriDebt: 0,
                zsoltiDebt: 0
            };
            const effectText = formatSharedRecordEffect(running.effect);
            const effectClass = getSharedEffectClass(running.effect);
            const runningBalanceText = formatSharedRunningBalance(running.net);
            const runningBalanceClass = getSharedRunningBalanceClass(running.net);
            const isSettlement = isSettlementRow(row);
            if (isSettlement) {
                tr.classList.add("settlement-row");
                tr.innerHTML = `
                <td>${row.month || ""}</td>
                <td>${formatDateForList(row.date)}</td>
                <td>${row.title || "Törlesztés"}</td>
                <td>${row.category || ""}</td>
                <td class="se-amount">${formatAmount(row.amount)}</td>
                <td>${row.paid_by || ""}</td>
                <!-- Megosztott mezők elrejtése -->
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td>${row.notes || ""}</td>
                <td class="shared-record-effect ${effectClass}">${effectText}</td>
                <td class="${runningBalanceClass}">${runningBalanceText}</td>
            `;
                tbody.appendChild(tr);
                return;
            }
            // ----- Nem törlesztés: marad a meglévő (megosztott) render -----
            tr.innerHTML = `
            <td>${row.month || ""}</td>
            <td>${formatDateForList(row.date)}</td>
            <td>${row.title || ""}</td>
            <td>${row.category || ""}</td>
            <td class="text-right">${formatAmount(row.amount)}</td>
            <td>${row.paid_by || ""}</td>
            <td class="text-right">
    ${(() => {
                    const v = Number(row.Zsolti_amount);
                    return (!v || v === 0) ? "" : formatAmount(Math.abs(v));
                })()}
        </td>
    <td class="text-right">
    ${(() => {
                    const v = Number(row.Dori_amount);
                    return (!v || v === 0) ? "" : formatAmount(Math.abs(v));
                })()}
    </td>
            <td class="text-right se-remaining">${formatAmount(row.remaining_amount)}</td>
            ${(() => {
                    const paidBy = String(row.paid_by || "").trim().toLowerCase();
                    const paidByDori = paidBy.includes("dóri") || paidBy === "dori";
                    const paidByZsolti = paidBy.includes("zsolti");
                    let zClass = "";
                    let dClass = "";
                    if (paidByDori) {
                        zClass = "balance-debit";
                        dClass = "balance-credit";
                    } else if (paidByZsolti) {
                        zClass = "balance-credit";
                        dClass = "balance-debit";
                    }
                    return `
                    <td class="text-right se-zsolti-balance">${formatAmount(row.Zsolti_balance)}</td>
                    <td class="text-right se-dori-balance">${formatAmount(row.Dori_balance)}</td>
                `;
                })()}
        <td>
            ${row.notes || ""}
        </td>
            <td class="shared-record-effect ${effectClass}">${effectText}</td>
            <td class="${runningBalanceClass}">${runningBalanceText}</td>

        `;
            tbody.appendChild(tr);
        });

    }
    catch (err) {
        console.error("Hiba a megosztott költségek betöltésekor:", err);
    }
}
window.loadSharedExpenses = loadSharedExpenses;

document.getElementById("refreshSharedExpensesBtn")?.addEventListener("click", async () => {
    if (!hasPermission("se_update", "write")) return;

    const button = document.getElementById("refreshSharedExpensesBtn");
    const status = document.getElementById("sharedExpensesRefreshStatus");
    if (button) button.disabled = true;
    if (status) status.textContent = "Frissítés...";

    try {
        const response = await api.refreshSharedExpenses();
        if (!response || response.success !== true) {
            throw new Error(response?.error || response?.message || "A frissítés nem sikerült.");
        }

        await loadSharedExpenses();
        if (status) {
            status.textContent =
                `Új: ${response.created || 0}, módosítva: ${response.updated || 0}, ` +
                `eltávolítva: ${response.deleted || 0}, változatlan: ${response.unchanged || 0}.`;
        }
    } catch (err) {
        console.error("Shared expenses refresh error:", err);
        if (status) status.textContent = err?.message || "A frissítés nem sikerült.";
    } finally {
        if (button) button.disabled = false;
    }
});

// ===== SHARED EXPENSES – FEJLÉCRE KATTINTVA RENDEZÉS (CSAK STATE) =====
document.querySelectorAll("#sharedExpensesTable thead th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;
        if (seSortField === field) {
            seSortDirection = (seSortDirection === "asc") ? "desc" : "asc";
        } else {
            seSortField = field;
            seSortDirection = "asc";
        }
    });
});

// ================================
// Shared Expenses – Modal open/close (NEW only)
// ================================
function hideSeModalMessages() {
    const ok = document.getElementById("seSuccessMsg");
    const er = document.getElementById("seErrorMsg");
    if (ok) ok.style.display = "none";
    if (er) er.style.display = "none";
}
let seModalIsSettlement = false;
function openSeModal(isSettlement) {
    seModalIsSettlement = !!isSettlement;
    const modal = document.getElementById("seModal");
    const overlay = document.getElementById("seModalOverlay");
    if (!modal || !overlay) return;
    // form reset
    const form = document.getElementById("seForm");
    if (form) {
        form.reset();
        form.removeAttribute("data-edit-id"); // <-- ÚJ: ne maradjon bent régi edit mód
    }
    // ÚJ: alapból ne lehessen törölni (csak szerkesztésnél, feltételesen)
    document.getElementById("seDeleteBtn")?.style.setProperty("display", "none");
    hideSeModalMessages();
    // cím + törlesztésnél bontás elrejtése
    const titleEl = document.getElementById("seModalTitle");
    const splitBlock = document.getElementById("seSplitBlock");
    if (titleEl) titleEl.textContent = isSettlement ? "Új törlesztés" : "Új megosztott tétel";
    if (splitBlock) splitBlock.style.display = isSettlement ? "none" : "block";
    // alapértékek (csak UX)
    const paidBy = document.getElementById("sePaidBy");
    if (paidBy && !paidBy.value) paidBy.value = "Zsolti";
    const name = document.getElementById("seTitle");
    if (name && isSettlement) name.value = "Törlesztés";
    modal.classList.add("open");
    overlay.classList.add("open");
}
window.openSeModal = openSeModal;
function closeSeModal() {
    document.getElementById("seModal")?.classList.remove("open");
    document.getElementById("seModalOverlay")?.classList.remove("open");
}
document.getElementById("addSharedExpenseBtn").addEventListener("click", () => {
    if (hasPermission("se_create", "write")) openSeModal(false);
});
document.getElementById("addSettlementInlineBtn")
    .addEventListener("click", () => {
        if (hasPermission("se_settlement_create", "write")) openSeModal(true);
    });
document.getElementById("seCloseBtn")?.addEventListener("click", closeSeModal);
// Megosztott / törlesztés tétel törlése modalból (csak törlesztés vagy paid_by=Zsolti)
document.getElementById("seDeleteBtn")?.addEventListener("click", async () => {
    if (!hasPermission("se_delete", "write")) return;

    const form = document.getElementById("seForm");
    const seId = form?.getAttribute("data-edit-id");
    if (!seId) return;
    // Frontend védelem: csak törlesztés vagy paid_by=Zsolti törölhető
    const row = seRowsById?.get(String(seId));
    const title = String(row?.title || "").trim().toLowerCase();
    const paidBy = String(row?.paid_by || "").trim().toLowerCase();
    const isSettlement = title.includes("törleszt");
    const isPaidByZsolti = (paidBy === "zsolti");
    const canDelete = isSettlement || isPaidByZsolti;
    if (!canDelete) {
        alert("Ez a tétel nem törölhető. Csak törlesztés vagy paid_by = Zsolti tétel törölhető.");
        return;
    }
    const ok = confirm("Biztosan törlöd ezt a tételt?");
    if (!ok) return;
    try {
        const resp = await api.deleteSharedExpense(seId);
        if (!resp || !resp.success) {
            alert(resp?.error || resp?.message || "A törlés nem sikerült.");
            return;
        }
        document.getElementById("seModal")?.classList.remove("open");
        document.getElementById("seModalOverlay")?.classList.remove("open");
    } catch (err) {
        console.error("deleteSharedExpense error:", err);
        alert("Váratlan hiba történt a törlés során.");
    }
});
// Modal – dátum → hónap automatikus kitöltés
document.getElementById("seDate")?.addEventListener("input", (e) => {
    const dateVal = e.target.value;
    const monthInput = document.getElementById("seMonth");
    if (!monthInput) return;
    monthInput.value = dateVal ? deriveMonth(dateVal) : "";
});
// Modal – Mentés (ÚJ tétel / ÚJ törlesztés)
document.getElementById("seForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editingRowId = document.getElementById("seModal").getAttribute("data-edit-id") || "";
    hideSeModalMessages();
    const date = (document.getElementById("seDate")?.value || "").trim();
    const title = (document.getElementById("seTitle")?.value || "").trim();
    const category = (document.getElementById("seCategory")?.value || "").trim();
    const paidBy = (document.getElementById("sePaidBy")?.value || "").trim();
    const notes = (document.getElementById("seNotes")?.value || "").trim();
    // Fontos: parseHuNumber kezeli a "2 000" és "2,5" formátumot is
    const amount = Math.abs(parseHuNumber(document.getElementById("seAmount")?.value));
    const zRaw = document.getElementById("seZsoltiAmount")?.value;
    const dRaw = document.getElementById("seDoriAmount")?.value;
    const zsoltiAmount = seModalIsSettlement ? 0 : Math.abs(parseHuNumber(zRaw || 0) || 0);
    const doriAmount = seModalIsSettlement ? 0 : Math.abs(parseHuNumber(dRaw || 0) || 0);
    if (!date || !title || !paidBy || isNaN(amount)) {
        document.getElementById("seErrorMsg").style.display = "block";
        alert("Dátum, megnevezés, fizette és összeg kötelező (összeg szám legyen).");
        return;
    }
    const month = deriveMonth(date);
    try {
        const payload = {
            month,
            date,
            title,
            category,
            amount,
            paid_by: paidBy,
            Zsolti_amount: zsoltiAmount,
            Dori_amount: doriAmount,
            notes
        };

        if (seModalIsSettlement) payload.settlement = "x";

        const editId = document.getElementById("seForm")?.getAttribute("data-edit-id");
        const requiredPermission = editId
            ? "se_inline_update"
            : (seModalIsSettlement ? "se_settlement_create" : "se_create");
        if (!hasPermission(requiredPermission, "write")) {
            alert("Nincs jogosultság a művelethez.");
            return;
        }

        let response;

        try {
            if (editId) {
                response = await api.updateSharedExpenseRow({ ...payload, id: editId });
            } else {
                response = await api.addSharedExpense(payload);
            }
        } catch (err) {
            console.error("Megosztott tétel mentése sikertelen:", err);
            alert("Nem sikerült kapcsolódni a szerverhez. Próbáld újra.");
            return;
        }

        if (!response || !response.success) {
            console.error("addSharedExpense FAILED:", response);
            alert(response?.error || response?.message || "Hiba a mentés során.");
            return;
        }

        closeSeModal();
        await loadSharedExpenses();
    } catch (err) {
        console.error("save shared expense error:", err);
        alert("Váratlan hiba történt mentés közben.");
    }
});
// ===== Shared Expenses – Row click opens modal for edit (no Edit button) =====
document.getElementById("sharedExpensesBody").addEventListener("click", (e) => {
    // Ha inputra kattint, akkor NE nyissunk modalt (maradjon az inline módosítás)
    if (e.target.closest("input, select, textarea, button")) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const rowId = tr.getAttribute("data-id");
    if (!rowId) return;
    const row = seRowsById.get(String(rowId));
    if (!row) return;
    if (!hasPermission("se_inline_update", "write")) return;
    // törlesztés felismerés ugyanazzal a logikával, mint rendernél
    const isSettlement = String(row.title || "").trim().toLowerCase().includes("törleszt");
    // modal megnyitása (resetel, beállítja a settlement UI-t)
    openSeModal(isSettlement);
    // szerkesztési mód jelölése (a későbbi mentés-logikához)
    const form = document.getElementById("seForm");
    if (form) form.setAttribute("data-edit-id", String(rowId));
    // mezők kitöltése
    const dateOnly = toInputDateLocal(row.date);
    document.getElementById("seDate").value = dateOnly || "";
    document.getElementById("seMonth").value = row.month || (dateOnly ? deriveMonth(dateOnly) : "");
    document.getElementById("seTitle").value = row.title || "";
    document.getElementById("seCategory").value = row.category || "";
    document.getElementById("seAmount").value = Math.abs(Number(row.amount) || 0);
    document.getElementById("sePaidBy").value = row.paid_by || "";
    // bontás mezők (törlesztésnél úgyis rejtve vannak, de értéket adhatunk)
    {
        const zVal = Number(row.Zsolti_amount);
        const dVal = Number(row.Dori_amount);
        document.getElementById("seZsoltiAmount").value =
            (!zVal || zVal === 0) ? "" : Math.abs(zVal);
        document.getElementById("seDoriAmount").value =
            (!dVal || dVal === 0) ? "" : Math.abs(dVal);
    }
    document.getElementById("seNotes").value = row.notes || "";
    // modal cím felülírása szerkesztésre
    const titleEl = document.getElementById("seModalTitle");
    if (titleEl) titleEl.textContent = isSettlement ? "Törlesztés szerkesztése" : "Megosztott tétel szerkesztése";

    const deleteBtn = document.getElementById("seDeleteBtn");
    const paidBy = String(row.paid_by || "").trim().toLowerCase();
    const canDeleteRow = isSettlement || paidBy === "zsolti";
    if (deleteBtn) {
        deleteBtn.style.display =
            hasPermission("se_delete", "write") && canDeleteRow
                ? "inline-block"
                : "none";
    }
});
// ===== Shared Expenses – Event Delegation =====
document.getElementById("sharedExpensesBody").addEventListener("change", async (e) => {
    const target = e.target;
    const rowId = target?.getAttribute("data-id") || "";
    if (rowId && !hasPermission("se_update", "write")) return;
    // --- CSAK a szám mezők (Zsolti/Dóri része) formázása ezres tagolással ---
    // Ne formázzunk title/paid_by/notes mezőt, mert abból "0" lesz (Number("") -> 0).
    if (
        target &&
        target.tagName === "INPUT" &&
        (target.classList.contains("se-zsolti-amount") || target.classList.contains("se-dori-amount"))
    ) {
        const raw = String(target.value ?? "");
        const cleaned = raw.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
        const asNumber = Number(cleaned.replace(",", "."));
        if (!isNaN(asNumber)) {
            target.value = formatAmount(asNumber);
        }
    }
    // Ha nincs sor azonosító (pl. inline új sor), akkor az updateSharedExpense ágakat kihagyjuk
    // (ettől még a Mentés/Mégse gombok működnek a saját click handlerükben)
    if (!rowId) {
        // Itt NE returnölj, ha a lentebb lévő gombokra (save-settlement stb.) támaszkodsz a change-ben.
        // Ha nálad a save/cancel gombok click eseménnyel mennek, akkor maradhat return.
    }
    if (!rowId) return;
    // 1) paid_by mező
    if (target.classList.contains("se-paid-by-input")) {
        const value = target.value.trim();
        if (!value) return;

        try {
            const resp = await api.updateSharedExpense(rowId, "paid_by", value);
            if (!resp || !resp.success) {
                alert(resp?.error || resp?.message || "Nem sikerült menteni a módosítást.");
                return;
            }

            const valueSets = await api.getValueSets();
            const existing = (valueSets?.sets?.paid_by || []).map(v => String(v).toLowerCase());

            if (!existing.includes(value.toLowerCase()) && hasPermission("value_sets_write", "write")) {
                const addValueResp = await api.addValueToSet("paid_by", value);
                if (!addValueResp || !addValueResp.success) {
                    alert(addValueResp?.error || addValueResp?.message || "Nem sikerült frissíteni a fizető felek listáját.");
                    return;
                }
            }

            await loadSharedExpenses();
        } catch (err) {
            console.error("paid_by módosítás sikertelen:", err);
            alert("Nem sikerült kapcsolódni a szerverhez. Próbáld újra.");
        }
        return;
    }
    // 2) Zsolti_amount mező
    if (target.classList.contains("se-zsolti-amount")) {
        let value = target.value;
        if (value === "" || value === null) {
            alert("A Zsolti része mező kötelező (0 is érvényes érték).");
            target.focus();
            return;
        }
        value = Number(String(value).replace(/\s+/g, "").replace(",", "."));
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Zsolti része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }
        const resp = await api.updateSharedExpense(rowId, "Zsolti_amount", value);
        if (!resp || !resp.success) {
            alert(resp?.error || "Nem sikerült menteni a módosítást.");
            return;
        }
        await loadSharedExpenses();
        return;
    }
    // 3) Dori_amount mező
    if (target.classList.contains("se-dori-amount")) {
        let value = target.value;
        if (value === "" || value === null) {
            alert("A Dóri része mező kötelező (0 is érvényes érték).");
            target.focus();
            return;
        }
        value = Number(String(value).replace(/\s+/g, "").replace(",", "."));
        value = Math.abs(value);
        if (isNaN(value)) {
            alert("A Dóri része mezőnek számnak kell lennie.");
            target.focus();
            return;
        }
        const resp = await api.updateSharedExpense(rowId, "Dori_amount", value);
        if (!resp || !resp.success) {
            alert(resp?.error || "Nem sikerült menteni a módosítást.");
            return;
        }
        await loadSharedExpenses();
    }
    // ================================
    // INLINE TÖRLESZTÉS MENTÉSE
    // ================================
    if (e.target.classList.contains("save-settlement")) {
        await saveInlineSettlement();
        return;
    }
    // ================================
    // INLINE TÖRLESZTÉS MÉGSE
    // ================================
    if (e.target.classList.contains("cancel-settlement")) {
        const row = document.querySelector(".new-settlement-row");
        if (row) row.remove();
        return;
    }
});
// ===== Shared Expenses – Live recalculation while typing (no save) =====
document.getElementById("sharedExpensesBody").addEventListener("input", (e) => {
    const target = e.target;
    // csak a két "saját rész" mezőre
    if (!target.classList.contains("se-zsolti-amount") && !target.classList.contains("se-dori-amount")) {
        return;
    }
    const tr = target.closest("tr");
    if (!tr) return;
    // amount az 5. oszlopban (index 4) van: "12 345 Ft"
    const amountText = (tr.children[4]?.textContent || "").replace(/\s/g, "");
    const amount = Math.abs(Number(amountText.replace("Ft", "").replace(",", ".")) || 0);
    // paid_by a 6. oszlopban (index 5)
    const paidBy = (tr.children[5]?.textContent || "").trim().toLowerCase();
    const zInput = tr.querySelector(".se-zsolti-amount");
    const dInput = tr.querySelector(".se-dori-amount");
    // gépelés közben üres lehet: ilyenkor 0-val számolunk csak preview-hoz
    const z = Math.abs(Number((zInput?.value ?? "").toString().replace(/\s+/g, "").replace(",", ".")) || 0);
    const d = Math.abs(Number((dInput?.value ?? "").toString().replace(/\s+/g, "").replace(",", ".")) || 0);
    const remaining = amount - d - z;
    const halfRemaining = remaining / 2;
    const zsoltiBal = halfRemaining + z;
    const doriBal = halfRemaining + d;
    // DOM frissítések
    const remCell = tr.querySelector(".se-remaining");
    const zbCell = tr.querySelector(".se-zsolti-balance");
    const dbCell = tr.querySelector(".se-dori-balance");
    const bCell = tr.querySelector(".se-balance");
    if (remCell) remCell.textContent = formatAmount(remaining);
    if (zbCell) zbCell.textContent = formatAmount(zsoltiBal);
    if (dbCell) dbCell.textContent = formatAmount(doriBal);
    // Egyenleg oszlop: paid_by szerint (ugyanaz a logika, mint backendben)
    if (bCell) {
        let impact = "";
        if (paidBy === "dóri" || paidBy === "dori") impact = zsoltiBal;
        else if (paidBy === "zsolti") impact = doriBal;
        bCell.textContent = formatAmount(impact);
    }
});
function createInlineSharedExpenseRow() {
    const tbody = document.getElementById("sharedExpensesBody");
    // új sor létrehozása, ami a táblázat tetejére kerül
    const tr = document.createElement("tr");
    tr.classList.add("new-shared-row");
    tr.innerHTML = `
        <td><input type="date" class="se-new-date"></td>
        <td><input list="titlesList" class="se-new-title" placeholder="Megnevezés"></td>
        <td><input list="categoriesList" class="se-new-category" placeholder="Kategória"></td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-amount"
                placeholder="Összeg"
            >
        </td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-zsoltiamount"
                placeholder="Zsolti része"
            >
        </td>
        <td>
            <input 
                type="number"
                inputmode="decimal"
                step="any"
                class="se-new-doriamount"
                placeholder="Dóri része"
            >
        </td>
        <td>
            <input 
                type="text"
                class="se-new-notes"
                placeholder="Megjegyzés"
            >
        </td>
        <td>
            <input class="se-new-paidby" list="paidByList" value="Zsolti">
        </td>
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
}

async function saveNewSharedExpense() {
    const tr = document.querySelector(".new-shared-row");
    if (!tr) return;
    const date = tr.querySelector(".se-new-date").value;
    const title = tr.querySelector(".se-new-title").value.trim();
    const category = tr.querySelector(".se-new-category").value.trim();
    const amount = Math.abs(Number(tr.querySelector(".se-new-amount").value));
    const paidBy = (tr.querySelector(".se-new-paidby")?.value || tr.querySelector(".se-new-paidby")?.textContent || "Zsolti").trim();
    const zsoltiAmount = Math.abs(Number(tr.querySelector(".se-new-zsoltiamount").value || 0));
    const doriAmount = Math.abs(Number(tr.querySelector(".se-new-doriamount").value || 0));
    const notes = (tr.querySelector(".se-new-notes")?.value || "").trim();
    if (!date || !title || isNaN(amount)) {
        alert("Dátum, megnevezés és összeg kötelező.");
        return;
    }
    // Hónap minden esetben a dátumból képződik (YYYYMM)
    const month = deriveMonth(date);
    let response;
    try {
        response = await api.addSharedExpense({
            month,
            date,
            title,                 // ne legyen fix "Törlesztés"
            category,
            amount,
            paid_by: paidBy,
            Zsolti_amount: zsoltiAmount,
            Dori_amount: doriAmount,
            notes
        });
    } catch (err) {
        console.error("Új megosztott költség mentése sikertelen:", err);
        alert("Nem sikerült kapcsolódni a szerverhez. Próbáld újra.");
        return;
    }

    if (!response || !response.success) {
        console.error("addSharedExpense FAILED:", response);
        alert(response?.error || response?.message || "Hiba az új megosztott költség mentésekor.");
        return;
    }

    // inline sor eltávolítása és lista frissítése
    tr.remove();
    await loadSharedExpenses();
}
function createInlineSettlementRow() {
    const tbody = document.getElementById("sharedExpensesBody");
    if (!tbody) return;
    // Egyszerre csak egy új törlesztés sor lehessen
    if (document.querySelector(".new-settlement-row")) return;
    const tr = document.createElement("tr");
    tr.classList.add("new-settlement-row");
    tr.innerHTML = `
        <td></td>
        <td>
            <input type="date" class="set-date">
        </td>
        <td>
            <input type="text" class="set-title" value="Törlesztés" list="titlesList">
        </td>
        <td class="settlement-hidden-cell"></td>
        <td>
            <input type="number" class="set-amount" inputmode="decimal" step="any" placeholder="Összeg">
        </td>
        <td>
            <input class="set-paidby" list="paidByList" value="Zsolti">
        </td>
        <!-- Megosztott mezők: törlesztésnél nem releváns -> elrejtjük -->
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <td class="settlement-hidden-cell"></td>
        <!-- Megjegyzés + gombok -->
        <td>
            <input type="text" class="set-notes" placeholder="Megjegyzés" style="margin-bottom:10px;">
            <div class="settlement-actions">
                <button type="button" class="btn-primary save-settlement">Mentés</button>
                <button type="button" class="btn-secondary cancel-settlement">Mégse</button>
            </div>
        </td>
        <!-- Rekord hatása; a göngyölített értékek mentés és újratöltés után jelennek meg -->
        <td class="shared-record-effect effect-settlement set-balance-preview">Zsolti tartozása −0 Ft</td>
        <td class="shared-running-balance is-zero">Mentés után számolható</td>
    `;
    tbody.prepend(tr);
    // Élő előnézet a rekord hatása cellában
    const amountInput = tr.querySelector(".set-amount");
    const previewCell = tr.querySelector(".set-balance-preview");
    amountInput.addEventListener("input", () => {
        const n = Math.abs(Number(amountInput.value) || 0);
        previewCell.textContent = `Zsolti tartozása −${formatAmount(n)} Ft`;
    });
    tr.querySelector(".cancel-settlement").addEventListener("click", () => tr.remove());
    tr.querySelector(".save-settlement").addEventListener("click", saveInlineSettlement);
}
async function saveInlineSettlement() {
    const tr = document.querySelector(".new-settlement-row");
    if (!tr) return;
    const date = tr.querySelector(".set-date").value;
    const title = (tr.querySelector(".set-title").value || "Törlesztés").trim();
    const amount = Math.abs(Number(tr.querySelector(".set-amount").value));
    const paidBy = (tr.querySelector(".set-paidby").value || "").trim();
    const notes = (tr.querySelector(".set-notes").value || "").trim();
    if (!date || !title || !amount || isNaN(amount)) {
        alert("Dátum, megnevezés és összeg kötelező.");
        return;
    }
    if (!paidBy) {
        alert("A 'Fizette' mező kötelező.");
        return;
    }
    const month = deriveMonth(date);
    // Settlement jelző + megosztott mezők nullázása
    let response;
    try {
        response = await api.addSharedExpense({
            month,
            date,
            title: title || "Törlesztés",
            amount,
            paid_by: paidBy,
            Zsolti_amount: 0,
            Dori_amount: 0,
            settlement: "x",
            notes
        });
    } catch (err) {
        console.error("Törlesztés mentése sikertelen:", err);
        alert("Nem sikerült kapcsolódni a szerverhez. Próbáld újra.");
        return;
    }

    if (!response || !response.success) {
        console.error("addSharedExpense (settlement) FAILED:", response);
        alert(response?.error || response?.message || "Hiba a törlesztés mentésekor.");
        return;
    }

    tr.remove();
    await loadSharedExpenses();
}
