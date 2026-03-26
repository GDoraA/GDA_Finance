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