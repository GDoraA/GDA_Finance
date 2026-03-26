async function loadSharedExpenses() {
    try {
        // ===== SORT ICONS RESET (SHARED EXPENSES) =====
        document.querySelectorAll("#sharedExpensesTable thead th[data-sort]").forEach(th => {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === seSortField) {
                th.classList.add(seSortDirection === "asc" ? "sort-asc" : "sort-desc");
            }
        });
        const result = await api.getSharedExpenses();
        const valueSetsResponse = await api.getValueSets();
        if (!result || !result.success) {
            console.error("Nem sikerült betölteni a megosztott költségeket.", result);
            return;
        }
        if (!valueSetsResponse || !valueSetsResponse.success) {
            console.error("Nem sikerült betölteni a value seteket.", valueSetsResponse);
            return;
        }
        const valueSets = valueSetsResponse.sets || {};
        const tbody = document.getElementById("sharedExpensesBody");
        tbody.innerHTML = "";
        seRowsById = new Map();
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
        (result.data || []).sort((a, b) => {
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
        const isSettlementRow = (r) => {
            const t = String(r.title || "").trim().toLowerCase();
            // Stabil, egyszerű szabály: "törleszt" szó alapján
            return t.includes("törleszt");
        };
        for (const row of (result.data || [])) {
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
        const headerNet = (redTotal - blueTotal) + purpleTotal;
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
        result.data.forEach(row => {
            const tr = document.createElement("tr");
            seRowsById.set(String(row.id), row);
            tr.setAttribute("data-id", row.id);
            const isSettlement = String(row.title || "").trim().toLowerCase().includes("törleszt");
            if (isSettlement) {
                tr.classList.add("settlement-row");
                tr.innerHTML = `
                <td>${row.month || ""}</td>
                <td>${formatDateForList(row.date)}</td>
                <td>${row.title || "Törlesztés"}</td>
                <td class="se-amount">${formatAmount(row.amount)}</td>
                <td>${row.paid_by || ""}</td>
                <!-- Megosztott mezők elrejtése -->
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <td class="settlement-hidden-cell"></td>
                <!-- Egyenleg lila -->
                <td class="balance-settlement">${formatAmount(row.amount)}</td>
                <td>
                    ${row.notes || ""}
                </td>
            `;
                tbody.appendChild(tr);
                return;
            }
            // ----- Nem törlesztés: marad a meglévő (megosztott) render -----
            tr.innerHTML = `
            <td>${row.month || ""}</td>
            <td>${formatDateForList(row.date)}</td>
            <td>${row.title || ""}</td>
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
            ${(() => {
                    const paidBy = String(row.paid_by || "").trim().toLowerCase();
                    const paidByDori = paidBy.includes("dóri") || paidBy === "dori";
                    const paidByZsolti = paidBy.includes("zsolti");
                    let value = "";
                    let cls = "";
                    if (paidByDori) {
                        value = row.Zsolti_balance;
                        cls = "balance-zsolti";
                    } else if (paidByZsolti) {
                        value = row.Dori_balance;
                        cls = "balance-dori";
                    }

                    return `<td class="text-right se-balance">${formatAmount(value)}</td>`;
                })()}

        <td>
            ${row.notes || ""}
        </td>

        `;
            tbody.appendChild(tr);
        });

    }
    catch (err) {
        console.error("Hiba a megosztott költségek betöltésekor:", err);
    }
}
window.loadSharedExpenses = loadSharedExpenses;
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
    document.getElementById("bankFirstPageBtn")?.addEventListener("click", () => {
        bankCurrentPage = 1;
        renderBankPreview(bankImportItems);
    });
    document.getElementById("bankPrevPageBtn")?.addEventListener("click", () => {
        bankCurrentPage = Math.max(1, bankCurrentPage - 1);
        renderBankPreview(bankImportItems);
    });
    document.getElementById("bankNextPageBtn")?.addEventListener("click", () => {
        // totalPages számítás: a szűrt találatok alapján
        const filterTextEl = document.getElementById("bankFilterText");
        const filterUnmatchedEl = document.getElementById("bankFilterUnmatchedOnly");
        const q = String(filterTextEl?.value ?? "").trim().toLowerCase();
        const unmatchedOnly = (filterUnmatchedEl?.checked === true);
        const filteredCount = (Array.isArray(bankImportItems) ? bankImportItems : []).filter(it => {
            if (unmatchedOnly && String(it?.matched_transaction_ids ?? "").trim() !== "") return false;
            if (!q) return true;
            return Object.values(it || {}).some(v => String(v ?? "").toLowerCase().includes(q));
        }).length;
        const perPageEl = document.getElementById("bankItemsPerPage");
        const perPageRaw = perPageEl ? perPageEl.value : "100";
        const pageSize =
            perPageRaw === "all"
                ? Math.max(1, filteredCount)
                : (Number(perPageRaw) || 100);

        const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
        bankCurrentPage = Math.min(totalPages, bankCurrentPage + 1);
        renderBankPreview(bankImportItems);
    });
    document.getElementById("bankLastPageBtn")?.addEventListener("click", () => {
        // totalPages számítás: a szűrt találatok alapján
        const filterTextEl = document.getElementById("bankFilterText");
        const filterUnmatchedEl = document.getElementById("bankFilterUnmatchedOnly");
        const q = String(filterTextEl?.value ?? "").trim().toLowerCase();
        const unmatchedOnly = (filterUnmatchedEl?.checked === true);
        const filteredCount = (Array.isArray(bankImportItems) ? bankImportItems : []).filter(it => {
            if (unmatchedOnly && String(it?.matched_transaction_ids ?? "").trim() !== "") return false;
            if (!q) return true;
            return Object.values(it || {}).some(v => String(v ?? "").toLowerCase().includes(q));
        }).length;
        const perPageEl = document.getElementById("bankItemsPerPage");
        const perPageRaw = perPageEl ? perPageEl.value : "100";
        const pageSize =
            perPageRaw === "all"
                ? Math.max(1, filteredCount)
                : (Number(perPageRaw) || 100);
        const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
        bankCurrentPage = totalPages;
        renderBankPreview(bankImportItems);
    });
    document.getElementById("bankItemsPerPage")?.addEventListener("change", () => {
        bankCurrentPage = 1;
        renderBankPreview(bankImportItems);
    });
    // Banki szűrők változására: vissza 1. oldalra + újrarender
    document.getElementById("bankFilterText")?.addEventListener("input", () => {
        bankCurrentPage = 1;
        clearTimeout(bankFilterTextDebounce);
        bankFilterTextDebounce = setTimeout(() => {
            renderBankPreview(bankImportItems);
        }, 180);
    });
    document.getElementById("bankFilterUnmatchedOnly")?.addEventListener("change", () => {
        bankCurrentPage = 1;
        renderBankPreview(bankImportItems);
    });
    document.getElementById("bankFilterHideInternalTransfers")?.addEventListener("change", () => {
        bankCurrentPage = 1;
        renderBankPreview(bankImportItems);
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
    document.getElementById("addSharedExpenseBtn").addEventListener("click", () => openSeModal(false));
    document.getElementById("addSettlementInlineBtn")
        .addEventListener("click", () => openSeModal(true));
    document.getElementById("seCloseBtn")?.addEventListener("click", closeSeModal);
    // Megosztott / törlesztés tétel törlése modalból (csak törlesztés vagy paid_by=Zsolti)
    document.getElementById("seDeleteBtn")?.addEventListener("click", async () => {
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
                amount,
                paid_by: paidBy,
                Zsolti_amount: zsoltiAmount,
                Dori_amount: doriAmount,
                notes
            };
            if (seModalIsSettlement) payload.settlement = "x";
            const editId = document.getElementById("seForm")?.getAttribute("data-edit-id");
            let response;
            if (editId) {
                response = await api.updateSharedExpenseRow({ ...payload, id: editId });
            } else {
                response = await api.addSharedExpense(payload);
            }
            if (!response || !response.success) {
                console.error("addSharedExpense FAILED:", response);
                document.getElementById("seErrorMsg").style.display = "block";
                alert(response?.error || response?.message || "Hiba történt a mentéskor.");
                return;
            }
            document.getElementById("seSuccessMsg").style.display = "block";
            closeSeModal();
            await loadSharedExpenses();
        } catch (err) {
            console.error("Shared Expense modal save error:", err);
            document.getElementById("seErrorMsg").style.display = "block";
            alert("Váratlan hiba történt a mentés során.");
        }
    });