
// =========================
// BANK IMPORT (CSV)
// =========================
let bankImportItems = [];
let filteredBankItems = [];
let bankImportSelectedFile = null;
let bankImportBatchId = "";
const bankPickBtn = document.getElementById("bankImportPickFileBtn");
const bankUploadBtn = document.getElementById("bankImportUploadBtn");
const bankFileInput = document.getElementById("bankImportFileInput");
const bankStatus = document.getElementById("bankImportStatus");
const bankHeadRow = document.getElementById("bankImportPreviewHead");
const bankBody = document.getElementById("bankImportPreviewBody");
const setBankStatus = (msg) => { if (bankStatus) bankStatus.textContent = msg || ""; };
function closeBankItemModal() {
    const modal = document.getElementById("bankItemModal");
    const overlay = document.getElementById("bankItemOverlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}
function openBankItemModal(item) {
    const modal = document.getElementById("bankItemModal");
    const overlay = document.getElementById("bankItemOverlay");
    const details = document.getElementById("bankItemDetails");
    const closeBtn = document.getElementById("bankItemCloseBtn");
    if (!modal || !overlay || !details) return;
    const fields = [
        ["id", "ID"],
        ["matched_transaction_ids", "TR ID"],
        ["month", "Hó"],
        ["transaction_date", "Tr.dátum"],
        ["posting_date", "Könyvelés"],
        ["amount", "Összeg"],
        ["direction", "Irány"],
        ["partner_name", "Partnernév"],
        ["partner_account", "Partner számla"],
        ["memo", "Közlemény"],
        ["type", "Típus"],
        ["spend_category", "Kategória"],
        ["account_name", "Számlanév"],
        ["account_number", "Számlaszám"],
        ["currency", "Deviza"],
        ["source_file", "Forrás"],
        ["import_batch_id", "Import ID"],
        ["created_by", "Rögzítő"],
        ["created_at", "Rögz. ideje"]
    ];
    const html = fields.map(([k, label]) => {
        const v = (item && item[k] != null) ? item[k] : "";
        const val = (String(v).trim() === "") ? "—" : escapeHtml(String(v));
        return `
            <div class="bank-item-field">
                <div class="bank-item-label">${escapeHtml(label)}</div>
                <div class="bank-item-value">${val}</div>
            </div>
        `;
    }).join("");
    details.innerHTML = `<div class="bank-item-grid">${html}</div>`;
    if (closeBtn && !closeBtn.__bankBound) {
        closeBtn.addEventListener("click", closeBankItemModal);
        closeBtn.__bankBound = true;
    }
    if (!overlay.__bankBound) {
        overlay.addEventListener("click", closeBankItemModal);
        overlay.__bankBound = true;
    }
    modal.classList.add("open");
    overlay.classList.add("open");
}
const toMonthYYYYMM = (isoDate) => {
    // isoDate: YYYY-MM-DD
    if (!isoDate || isoDate.length < 7) return "";
    return isoDate.slice(0, 4) + isoDate.slice(5, 7);
};
const normalizeAmount = (v) => {
    // CSV-ből jöhet string "1 234,56", stb.
    if (v == null) return "";
    if (typeof v === "number") return v;
    const s = String(v).trim()
        .replace(/\s+/g, "")
        .replace(/ft/ig, "")
        .replace(",", ".");
    const n = Number(s);
    return isNaN(n) ? "" : n;
};
const renderBankPreview = (items) => {
    if (!bankHeadRow || !bankBody) return;
    const safeItems = Array.isArray(items) ? items : [];
    // ===== BANK – KÉPERNYŐ SZŰRÉS + RENDEZÉS =====
    const filterTextEl = document.getElementById("bankFilterText");
    const filterUnmatchedEl = document.getElementById("bankFilterUnmatchedOnly");
    const q = String(filterTextEl?.value ?? "").trim().toLowerCase();
    const unmatchedOnly = (filterUnmatchedEl?.checked === true);
    // 1) szűrés
    let workingItems = safeItems.filter(it => {
        if (unmatchedOnly && String(it?.matched_transaction_ids ?? "").trim() !== "") return false;
        if (!q) return true;
        // teljes sorban keresünk (összes mező)
        // teljes sorban keresünk (összes mező) + összeg normalizált egyezés
        const rowMatch = Object.values(it || {}).some(v => String(v ?? "").toLowerCase().includes(q));
        if (rowMatch) return true;
        // Összeg egyezés normalizeAmount alapján (pl. "1234,56" ~= "1 234,56")
        const qNum = q.replace(/\s+/g, "").replace(",", ".");
        const amt = normalizeAmount(it?.amount);
        if (typeof amt === "number" && qNum) {
            const amtStr = String(amt);           // pl. "1234.56"
            if (amtStr.includes(qNum)) return true;
        }
        return false;
    });
    const hideInternalTransfers =
        document.getElementById("bankFilterHideInternalTransfers")?.checked === true;
    let hiddenInternalCount = 0;
    // Saját számlák közti utalások elrejtése (pontosítva):
    // csak akkor tekintjük belső utalásnak, ha
    // - van Bejövő + Kimenő ugyanazzal az abs(amount)-tal, ÉS
    // - a tétel account_number / partner_account mezői közül legalább az egyik a Saját számlák listában van
    if (hideInternalTransfers) {
        // Saját számlák cache: a Saját számlák oldalon a loadOwnAccounts() már betölti,
        // itt csak felhasználjuk, ha elérhető.
        const ownList = (typeof window !== "undefined" && Array.isArray(window.__ownAccountsCache))
            ? window.__ownAccountsCache
            : [];
        const normAcc = (s) => String(s ?? "").replace(/\s+/g, "").trim().toLowerCase();
        const ownSet = new Set(ownList.map(normAcc).filter(Boolean));
        const classifyDir = (dirRaw, amt) => {
            const d = String(dirRaw ?? "").trim().toLowerCase();
            // Magyar
            if (d === "bejövő" || d === "bejövo") return "in";
            if (d === "kimenő" || d === "kimeno") return "out";
            // Nemzetközi / bank exportok
            if (d === "credit" || d === "cr" || d === "c") return "in";
            if (d === "debit" || d === "dr" || d === "d") return "out";
            // Ha nincs jól kitöltött irány, próbáljuk az előjelből
            if (typeof amt === "number") {
                if (amt < 0) return "out";
                if (amt > 0) return "in";
            }
            return "";
        };
        const flagsByAbsAmount = new Map(); // absAmount -> { in: bool, out: bool }
        for (const it of workingItems) {
            const amt = normalizeAmount(it?.amount);
            if (typeof amt !== "number") continue;
            const dirClass = classifyDir(it?.direction, amt);
            const absAmt = Math.abs(amt);
            const acc1 = normAcc(it?.account_number);
            const acc2 = normAcc(it?.partner_account);
            // csak akkor vesszük figyelembe “belső” jelöltnek, ha saját számlaszám érintett
            const touchesOwn = ownSet.has(acc1) || ownSet.has(acc2);
            if (!touchesOwn) continue;
            if (!flagsByAbsAmount.has(absAmt)) flagsByAbsAmount.set(absAmt, { in: false, out: false });
            const rec = flagsByAbsAmount.get(absAmt);
            if (dirClass === "in") rec.in = true;
            else if (dirClass === "out") rec.out = true;
        }
        const internalAbsAmounts = new Set(
            Array.from(flagsByAbsAmount.entries())
                .filter(([_, v]) => v.in && v.out)
                .map(([k]) => k)
        );
        // csak azokat rejtjük el, amiknél saját számla is érintett (ugyanazzal a logikával)
        workingItems = workingItems.filter(it => {
            const amt = normalizeAmount(it?.amount);
            if (typeof amt !== "number") return true;
            const acc1 = normAcc(it?.account_number);
            const acc2 = normAcc(it?.partner_account);
            const touchesOwn = ownSet.has(acc1) || ownSet.has(acc2);
            if (!touchesOwn) return true;
            const isInternal = internalAbsAmounts.has(Math.abs(amt));
            if (isInternal) hiddenInternalCount++;
            return !isInternal;
        });
    }
    const hideInternalCb = document.getElementById("bankFilterHideInternalTransfers");
    const hideInternalLabel = hideInternalCb?.closest("label");
    if (hideInternalLabel) {
        const baseText = "Saját számlák közti utalások elrejtése";
        const newText =
            hideInternalTransfers && hiddenInternalCount > 0
                ? ` ${baseText} (${hiddenInternalCount} elrejtve)`
                : ` ${baseText}`;
        // Töröljük a label összes szöveg node-ját (a behúzások/újsorok is text node-ok),
        // majd visszaírunk egyetlen, egységes feliratot.
        Array.from(hideInternalLabel.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) hideInternalLabel.removeChild(n);
        });
        hideInternalLabel.appendChild(document.createTextNode(newText));
    }
    // 2) rendezés (bankSortField / bankSortDirection state alapján)
    const toComparable = (val, field) => {
        if (val == null) return "";
        if (field === "amount") {
            const n = normalizeAmount(val);
            return (typeof n === "number") ? n : 0;
        }
        // dátum mezők: "YYYY-MM-DD" vagy "YYYY-MM-DD HH:mm:ss"
        if (field === "transaction_date" || field === "posting_date" || field === "created_at") {
            const s = String(val).trim();
            const t = Date.parse(s.replace(" ", "T"));
            return isNaN(t) ? 0 : t;
        }
        return String(val).toLowerCase();
    };
    const dirMul = (bankSortDirection === "asc") ? 1 : -1;
    workingItems = workingItems.slice().sort((a, b) => {
        const av = toComparable(a?.[bankSortField], bankSortField);
        const bv = toComparable(b?.[bankSortField], bankSortField);
        if (typeof av === "number" && typeof bv === "number") {
            return (av - bv) * dirMul;
        }
        return String(av).localeCompare(String(bv), "hu") * dirMul;
    });
    const perPageEl = document.getElementById("bankItemsPerPage");
    const perPageValue = perPageEl ? perPageEl.value : "all";
    const paginationBox = document.getElementById("bankImportPagination");
    if (typeof bankCurrentPage === "undefined") {
        window.bankCurrentPage = 1;
    }
    const pageSize2 = readPageSize("bankItemsPerPage", workingItems.length, 100);
    const meta = getPaginationMeta(workingItems.length, pageSize2, bankCurrentPage);
    bankCurrentPage = meta.page;
    let pageItems = workingItems;
    if (perPageValue !== "all") {
        if (paginationBox) paginationBox.style.display = "flex";
        pageItems = workingItems.slice(meta.start, meta.end);
        updatePaginationUI(
            {
                pageInfoId: "bankPageInfo",
                resultCountId: "bankImportResultCount",
                firstBtnId: "bankFirstPageBtn",
                prevBtnId: "bankPrevPageBtn",
                nextBtnId: "bankNextPageBtn",
                lastBtnId: "bankLastPageBtn"
            },
            meta.page,
            meta.totalPages,
            pageItems.length,
            workingItems.length

        );
    } else {
        bankCurrentPage = 1;
        if (paginationBox) paginationBox.style.display = "none";
        const resultCountEl = document.getElementById("bankImportResultCount");
        if (resultCountEl) resultCountEl.textContent = `Találatok: ${workingItems.length} / ${safeItems.length} db`;
    }
    // a sheet (backend) 18 mezős struktúrája
    const cols = [
        "id",
        "matched_transaction_ids",
        "month",
        "transaction_date",
        "posting_date",
        "amount",
        "direction",
        "partner_name",
        "partner_account",
        "memo",
        "type",
        "spend_category",
        "account_name",
        "account_number",
        "currency",
        "source_file",
        "import_batch_id",
        "created_by",
        "created_at"
    ];
    // A "Típus" oszloptól kezdve mindent elrejtünk (type és utána)
    const typeIdx = cols.indexOf("type");
    const visibleCols = (typeIdx > -1) ? cols.slice(0, typeIdx) : cols;
    const labels = {
        id: "ID",
        matched_transaction_ids: "TR ID",
        month: "Hó",
        transaction_date: "Tr.dátum",
        posting_date: "Könyvelés",
        amount: "Összeg",
        direction: "Irány",
        partner_name: "Partnernév",
        partner_account: "Partner számla",
        memo: "Közlemény",
        type: "Típus",
        spend_category: "Kategória",
        account_name: "Számlanév",
        account_number: "Számlaszám",
        currency: "Deviza",
        source_file: "Forrás",
        import_batch_id: "Import ID",
        created_by: "Rögzítő",
        created_at: "Rögz. ideje"
    };
    // fejléc
    bankHeadRow.innerHTML = "";
    visibleCols.forEach((c) => {
        const th = document.createElement("th");
        const isActive = (c === bankSortField);
        const arrow = isActive ? (bankSortDirection === "asc" ? " ▲" : " ▼") : "";
        th.textContent = (labels[c] || c) + arrow;
        th.dataset.sort = c;
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            if (bankSortField === c) {
                bankSortDirection = (bankSortDirection === "asc") ? "desc" : "asc";
            } else {
                bankSortField = c;
                // alapértelmezett irány: dátum/összeg desc, egyéb asc
                if (c === "transaction_date" || c === "posting_date" || c === "created_at" || c === "amount") {
                    bankSortDirection = "desc";
                } else {
                    bankSortDirection = "asc";
                }
            }
            bankCurrentPage = 1;
            renderBankPreview(bankImportItems);
        });
        bankHeadRow.appendChild(th);
    });
    // body (max 200 sor preview)
    bankBody.innerHTML = "";
    pageItems.forEach((it) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.addEventListener("click", (ev) => {
            if (ev.target && ev.target.closest("button,a,input,select,textarea,label")) return;
            openBankItemModal(it);
        });
        visibleCols.forEach((c) => {
            const td = document.createElement("td");
            if (c === "matched_transaction_ids") {
                const bankId = String(it?.id ?? "").trim();
                const txIds = bankToTxMap.get(bankId) || [];
                td.textContent = txIds.join(", ");
                tr.appendChild(td);
                return;
            }
            const v = (it && it[c] != null) ? it[c] : "";
            td.textContent = String(v);
            tr.appendChild(td);
        });
        bankBody.appendChild(tr);
    });
    // Megjelenített / összes tétel
    // Megjelenített / összes (szűrt) tétel
    const resultCountEl = document.getElementById("bankImportResultCount");
    if (resultCountEl) {
        // workingItems: a szűrés + rendezés utáni lista (erre kell a nevező)
        resultCountEl.textContent = `Találatok: ${pageItems.length} / ${workingItems.length} db`;
    }
    // Gombok tiltása (eleje/vége + előző/következő)
    const firstBtn = document.getElementById("bankFirstPageBtn");
    const prevBtn = document.getElementById("bankPrevPageBtn");
    const nextBtn = document.getElementById("bankNextPageBtn");
    const lastBtn = document.getElementById("bankLastPageBtn");
    const atFirst = (bankCurrentPage <= 1);
    const atLast = (bankCurrentPage >= meta.totalPages);
    if (firstBtn) firstBtn.disabled = atFirst;
    if (prevBtn) prevBtn.disabled = atFirst;
    if (nextBtn) nextBtn.disabled = atLast;
    if (lastBtn) lastBtn.disabled = atLast;
};
async function loadBankTransactions() {
    try {
        await ensureOwnAccountsCache();

        if (!api?.getBankTransactions) {
            setBankStatus("Hiba: api.getBankTransactions nincs definiálva (api.js).");
            return;
        }

        setBankStatus("Banki adatok betöltése…");

        let res;
        try {
            res = await api.getBankTransactions();
        } catch (err) {
            console.error("Banki tranzakciók betöltése sikertelen:", err);
            setBankStatus("Nem sikerült kapcsolódni a szerverhez a banki adatok betöltésekor.");
            return;
        }

        if (!res || !res.success) {
            console.error("Nem sikerült betölteni a banki tranzakciókat.", res);
            setBankStatus(`Nem sikerült betölteni a banki adatokat: ${res?.error || res?.message || "ismeretlen hiba"}`);
            return;
        }

        bankImportItems = Array.isArray(res.data) ? res.data : [];
        renderBankPreview(bankImportItems);
        setBankStatus(`Betöltve: ${bankImportItems.length} sor.`);
    } catch (err) {
        console.error("Hiba a banki adatok betöltése során:", err);
        setBankStatus("Hiba a banki adatok betöltése során.");
    }
}
const parseBankImportFile = async (file) => {
    const buf = await file.arrayBuffer();
    const decode = (enc) => {
        const dec = new TextDecoder(enc, { fatal: false });
        let txt = dec.decode(buf);
        if (txt && txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // BOM
        return txt;
    };
    const looksBad = (s) => ((s.match(/\uFFFD/g) || []).length >= 2);
    let text = decode("utf-8");
    if (looksBad(text)) {
        try { text = decode("windows-1250"); } catch (e) { }
    }
    const linesRaw = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);
    if (!linesRaw || linesRaw.length < 2) return [];
    const detectDelimiterLocal = (line) => {
        if (line.indexOf("\t") >= 0) return "\t";
        const commas = (line.match(/,/g) || []).length;
        const semis = (line.match(/;/g) || []).length;
        return semis > commas ? ";" : ",";
    };
    const parseCsvLineLocal = (line, delimiter) => {
        const out = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (!inQuotes && ch === delimiter) {
                out.push(cur);
                cur = "";
                continue;
            }
            cur += ch;
        }
        out.push(cur);
        return out.map(s => s.trim());
    };
    const delimiter = detectDelimiterLocal(linesRaw[0]);
    const rows = linesRaw.map(line => parseCsvLineLocal(line, delimiter));
    const H = (rows[0] || []).map(h => String(h || "").trim().toLowerCase());
    const idx = (...names) => {
        const wanted = names.map(n => String(n).trim().toLowerCase());
        for (let i = 0; i < H.length; i++) {
            const h = H[i];
            if (!h) continue;
            if (wanted.includes(h)) return i;
        }
        for (let i = 0; i < H.length; i++) {
            const h = H[i];
            if (!h) continue;
            if (wanted.some(w => w && h.includes(w))) return i;
        }
        return -1;
    };
    const iTxDate = idx("transaction_date", "tranzakció dátum", "tranzakcio datum", "dátum", "datum", "value date", "transaction date");
    const iPost = idx("posting_date", "könyvelés dátum", "konyveles datum", "posting date", "book date");
    const iAmt = idx("amount", "összeg", "osszeg", "sum", "érték", "amount (huf)");
    const iMemo = idx("memo", "közlemény", "kozlemeny", "megjegyzés", "megjegyzes", "comment", "note");
    // + további mezők a te 18 oszlopos sémádhoz
    const iType = idx("type", "típus", "tipus", "trn type", "transaction type");
    const iDirection = idx("direction", "irány", "irany", "debit/credit", "credit/debit", "dr/cr");
    const iPartnerName = idx("partner_name", "partner neve", "ellenoldali név", "ellenoldali nev", "counterparty name", "beneficiary");
    const iPartnerAcc = idx("partner_account", "partner számla", "partner szamla", "ellenoldali számla", "ellenoldali szamla", "counterparty account", "iban");
    const iSpendCategory = idx("spend_category", "kategória", "kategoria", "category");
    const iAccName = idx("account_name", "számla neve", "szamla neve", "account name");
    const iAccNumber = idx("account_number", "számlaszám", "szamlaszam", "account number");
    const iCurrency = idx("currency", "deviza", "pénznem", "penznem", "ccy");
    const getCell = (row, i) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    const items = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const rawTxDate = (iTxDate >= 0 ? row[iTxDate] : row[0]) ?? "";
        const rawAmt = (iAmt >= 0 ? row[iAmt] : row[row.length - 1]) ?? "";
        const txDateIso = toIsoDate(rawTxDate);
        const amt = normalizeAmount(rawAmt);
        if (!txDateIso || amt === "" || amt == null) continue;
        const postingIso = (iPost >= 0) ? toIsoDate(row[iPost]) : "";
        const currency = getCell(row, iCurrency) || "HUF";
        items.push({
            // id-t a backend generálja
            id: "",
            month: toMonthYYYYMM(txDateIso),
            transaction_date: txDateIso,
            posting_date: postingIso,
            type: getCell(row, iType),
            direction: getCell(row, iDirection),
            partner_name: getCell(row, iPartnerName),
            partner_account: getCell(row, iPartnerAcc),
            spend_category: getCell(row, iSpendCategory),
            memo: (iMemo >= 0 ? String(row[iMemo] ?? "").trim() : ""),
            account_name: getCell(row, iAccName),
            account_number: getCell(row, iAccNumber),
            amount: amt,
            currency,
            source_file: (file && file.name) ? file.name : "",
            import_batch_id: "",
            created_by: "",
            created_at: ""
        });
    }
    return items;
};
bankPickBtn?.addEventListener("click", () => bankFileInput?.click());
bankFileInput?.addEventListener("change", async (e) => {
    bankImportItems = [];
    bankImportSelectedFile = null;

    if (bankUploadBtn) bankUploadBtn.disabled = true;
    setBankStatus("");

    const file = e.target.files?.[0];
    if (!file) return;

    bankImportSelectedFile = file;

    // NE töröld le a táblát! A képernyőn maradjon a sheetből betöltött lista.
    setBankStatus(`Kiválasztva: ${file.name}`);
    setBankStatus("Feldolgozás…");

    let items;
    try {
        items = await parseBankImportFile(file);
    } catch (err) {
        console.error("Importfájl feldolgozása sikertelen:", err);
        if (bankUploadBtn) bankUploadBtn.disabled = true;
        setBankStatus("Nem sikerült feldolgozni a kiválasztott fájlt.");
        return;
    }

    // import batch azonosító generálása betöltéskor (1 fájl = 1 batch)
    bankImportBatchId = `BIMP-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    // bankImportItems: ez megy majd mentésre, de NEM rendereljük ki preview-ként
    bankImportItems = (items || []).map(it => ({
        ...it,
        source_file: (file && file.name) ? file.name : (it?.source_file || ""),
        import_batch_id: bankImportBatchId
    }));

    if (!bankImportItems || bankImportItems.length === 0) {
        if (bankUploadBtn) bankUploadBtn.disabled = true;
        setBankStatus("Nincs importálható adat (üres vagy hibás struktúra).");
        return;
    }

    if (bankUploadBtn) bankUploadBtn.disabled = false;
    setBankStatus(`Beolvasva: ${bankImportItems.length} sor. Mentéshez kattints az Import gombra.`);
});
bankUploadBtn?.addEventListener("click", async () => {
    try {
        if (!bankImportSelectedFile) {
            setBankStatus("Nincs kiválasztott fájl.");
            return;
        }

        if (!bankImportBatchId) {
            setBankStatus("Hiányzik az import batch azonosító (import_batch_id). Válaszd ki újra a fájlt.");
            return;
        }

        if (!bankImportItems || bankImportItems.length === 0) {
            setBankStatus("Nincs importálható sor.");
            return;
        }

        if (!api?.addBankTransactions) {
            setBankStatus("Hiba: api.addBankTransactions nincs definiálva (api.js).");
            return;
        }

        setBankStatus("Mentés folyamatban…");
        bankUploadBtn.disabled = true;

        let ok = 0;
        let fail = 0;
        let matched = 0;
        let unmatched = 0;
        const BANK_BATCH_SIZE = 50;

        async function sendBatchWithSplit(payloads) {
            if (!payloads || payloads.length === 0) return;

            try {
                const resp = await api.addBankTransactions(payloads);

                if (!resp || !resp.success) {
                    console.error("Bank batch mentés sikertelen:", resp);
                    fail += payloads.length;
                    return;
                }

                ok += Number(resp.ok ?? 0);
                fail += Number(resp.fail ?? 0);
                matched += Number(resp.matched ?? 0);
                unmatched += Number(resp.unmatched ?? 0);
                return;
            } catch (err) {
                const msg = (err && err.message) ? err.message : String(err || "Ismeretlen hiba");
                const isJsonp = String(msg).toLowerCase().includes("jsonp");

                if (!isJsonp || payloads.length <= 1) {
                    console.error("Bank batch mentés hiba:", err);
                    fail += payloads.length;
                    return;
                }

                const mid = Math.ceil(payloads.length / 2);
                await sendBatchWithSplit(payloads.slice(0, mid));
                await sendBatchWithSplit(payloads.slice(mid));
            }
        }

        for (let i = 0; i < bankImportItems.length; i += BANK_BATCH_SIZE) {
            const batch = bankImportItems.slice(i, i + BANK_BATCH_SIZE);
            await sendBatchWithSplit(batch);

            setBankStatus(
                `Mentés fut… OK: ${ok}, Hiba: ${fail} (batch: ${Math.min(i + BANK_BATCH_SIZE, bankImportItems.length)}/${bankImportItems.length})`
            );
        }

        setBankStatus(`Mentve. OK: ${ok}, Hiba: ${fail}, Párosítva: ${matched}, Nem párosítható: ${unmatched}`);
        await loadBankTransactions();
    } catch (err) {
        console.error("Hiba a banki import mentése során:", err);
        setBankStatus("Hiba a mentés során.");
    } finally {
        if (bankUploadBtn) bankUploadBtn.disabled = false;
    }
});
// =========================
// Saját számlák (value_sets: own_account) – UI nélkül
// =========================
const OWN_ACCOUNTS_SET = "Own_account";
async function ensureOwnAccountsCache() {
    try {
        const res = await api.getValueSets();
        if (!res || !res.success) {
            window.__ownAccountsCache = [];
            return;
        }
        const sets = res.sets || {};
        const list = sets[OWN_ACCOUNTS_SET] || [];
        window.__ownAccountsCache = Array.isArray(list) ? list : [];
    } catch (e) {
        console.error("Saját számlák cache betöltés hiba:", e);
        window.__ownAccountsCache = [];
    }
}

function renderOwnAccounts(list) {
    const tbody = document.getElementById("ownAccountsBody");
    if (!tbody) return;
    const items = Array.isArray(list) ? list : [];
    tbody.innerHTML = items
        .map(v => {
            const safe = escapeHtml(String(v ?? "").trim());
            return `
                <tr>
                    <td>${safe}</td>
                    <td class="text-right">
                        <button type="button" class="secondary" disabled title="Törlés később">Törlés</button>
                    </td>
                </tr>
            `;
        })
        .join("");
}
async function loadOwnAccounts() {
    setOwnAccountsMsg("");
    const res = await api.getValueSets();
    if (!res || !res.success) {
        setOwnAccountsMsg("Nem sikerült betölteni a saját számlákat (getValueSets).", true);
        return;
    }
    const sets = res.sets || {};
    const list = sets[OWN_ACCOUNTS_SET] || [];
    window.__ownAccountsCache = Array.isArray(list) ? list : [];
    renderOwnAccounts(window.__ownAccountsCache);
}
document.getElementById("ownAccountsForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setOwnAccountsMsg("");
    const input = document.getElementById("ownAccountIban");
    const raw = String(input?.value ?? "").trim();
    if (!raw) return;
    const value = raw.replace(/\s+/g, ""); // szóközök nélkül tároljuk
    const r = await api.addValueToSet(OWN_ACCOUNTS_SET, value);
    if (!r || !r.success) {
        setOwnAccountsMsg(`Nem sikerült hozzáadni: ${r?.error || "ismeretlen hiba"}`, true);
        return;
    }
    if (input) input.value = "";
    await loadOwnAccounts();
    setOwnAccountsMsg("Hozzáadva.");
});
window.ensureOwnAccountsCache = ensureOwnAccountsCache;
window.loadOwnAccounts = loadOwnAccounts;