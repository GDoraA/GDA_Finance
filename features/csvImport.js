    // =========================
    // CSV IMPORT (Transactions)
    // =========================
    let csvImportCancelled = false;
    const importBtn = document.getElementById("importCsvBtn");
    const importInput = document.getElementById("importCsvInput");
    const importStatus = document.getElementById("importStatus");
    const cancelImportBtn = document.getElementById("cancelImportBtn");
    const importErrorsBox = document.getElementById("importErrors");
    const renderImportErrors = (errors) => {
        if (!importErrorsBox) return;
        if (!errors || errors.length === 0) {
            importErrorsBox.style.display = "none";
            importErrorsBox.innerHTML = "";
            return;
        }
        const items = errors.slice(0, 200).map(e => {
            const reason = e.reason ? `<div><strong>Ok:</strong> ${escapeHtml(e.reason)}</div>` : "";
            const raw = e.rawLine ? `<div><strong>Sor:</strong> <code>${escapeHtml(e.rawLine)}</code></div>` : "";
            return `
                <div class="csv-error-item">
                    <div><strong>#${e.rowNumber}</strong>${e.phase ? ` — ${escapeHtml(e.phase)}` : ""}</div>
                    ${reason}
                    ${raw}
                </div>
            `;
        }).join("");
        const more = errors.length > 200
            ? `<div class="csv-error-more">További hibák: ${errors.length - 200} (a megjelenítés 200 sorra korlátozott)</div>`
            : "";
        importErrorsBox.innerHTML = `
            <div class="csv-errors-title"><strong>Hibás / kihagyott sorok (${errors.length} db)</strong></div>
            ${items}
            ${more}
        `;
        importErrorsBox.style.display = "block";
    };
    cancelImportBtn?.addEventListener("click", () => {
        csvImportCancelled = true;
        setImportStatus("Import leállítva felhasználó által.");
    });
    // CSV súgó panel toggle
    const csvHelpBtn = document.getElementById("csvHelpBtn");
    const csvHelpPanel = document.getElementById("csvHelpPanel");
    csvHelpBtn?.addEventListener("click", () => {
        csvHelpPanel?.classList.toggle("open");
    });
    const setImportStatus = (msg) => {
        if (importStatus) importStatus.textContent = msg || "";
    };
    // Egyszerű delimiter detektálás: HU bankoknál gyakori a ';'
    const detectDelimiter = (line) => {
        const commas = (line.match(/,/g) || []).length;
        const semis = (line.match(/;/g) || []).length;
        return semis > commas ? ";" : ",";
    };
    // CSV sor parse (idézőjeles mezők támogatása)
    const parseCsvLine = (line, delimiter) => {
        const out = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                // dupla idéző escape: ""
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
    const normalizeMonth = (raw, fallbackDateIso) => {
        const s = String(raw ?? "").trim();
        // Ha a CSV-ben már YYYYMM formátum van (pl. 202509), használjuk azt
        if (/^\d{6}$/.test(s)) return s;
        // Egyébként számoljuk a dátumból YYYYMM-re
        if (fallbackDateIso) {
            const [y, m] = fallbackDateIso.split("-");
            return `${y}${m}`;
        }
        return "";
    };
    // A meglévő logikádhoz illeszkedő előjelzés:
    // - UI/import: pozitív összegből indulunk
    // - Mentés: Kiadás -> negatív, Bevétel -> pozitív
    const normalizeSignedAmountForSave = (absAmount, txType) => {
        const n = Number(absAmount);
        if (isNaN(n)) return "";
        const abs = Math.abs(n);
        const t = String(txType || "").trim().toLowerCase();
        // magyar kulcsszavak toleráns kezelése
        const isExpense = t.includes("kiad");   // Kiadás
        const isIncome = t.includes("bev");    // Bevétel
        if (isExpense) return String(-abs);
        if (isIncome) return String(abs);
        // ha nincs típus, akkor marad pozitív (biztonságos alapértelmezés)
        return String(abs);
    };
    // Header -> mező térkép (rugalmas: többféle fejlécet elfogad)
    const pick = (obj, keys) => {
        for (const k of keys) {
            if (k in obj && String(obj[k] ?? "").trim() !== "") return obj[k];
        }
        return "";
    };
    importBtn?.addEventListener("click", () => {
        setImportStatus("");
        importInput?.click();
    });
    importInput?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setImportStatus("CSV olvasása...");
            const importErrors = [];
            renderImportErrors([]); // ürítés a képernyőn
            csvImportCancelled = false;
            if (cancelImportBtn) cancelImportBtn.style.display = "inline-block";
            // --- CP852 (DOS Central Europe) dekóder táblázat (0x80..0xFF) ---
            const CP852_TABLE = [0xc7, 0xfc, 0xe9, 0xe2, 0xe4, 0x16f, 0x107, 0xe7, 0x142, 0xeb, 0x150, 0x151, 0xee, 0x179, 0xc4, 0x106, 0xc9, 0x139, 0x13a, 0xf4, 0xf6, 0x13d, 0x13e, 0x15a, 0x15b, 0xd6, 0xdc, 0x164, 0x165, 0x141, 0xd7, 0x10d, 0xe1, 0xed, 0xf3, 0xfa, 0x104, 0x105, 0x17d, 0x17e, 0x118, 0x119, 0xac, 0x17a, 0x10c, 0x15f, 0xab, 0xbb, 0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0xc1, 0xc2, 0x11a, 0x15e, 0x2563, 0x2551, 0x2557, 0x255d, 0x17b, 0x17c, 0x2510, 0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x102, 0x103, 0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0xa4, 0x111, 0x110, 0x10e, 0xcb, 0x10f, 0x147, 0xcd, 0xce, 0x11b, 0x2518, 0x250c, 0x2588, 0x2584, 0x162, 0x16e, 0x2580, 0xd3, 0xdf, 0xd4, 0x143, 0x144, 0x148, 0x160, 0x161, 0x154, 0xda, 0x155, 0x170, 0xfd, 0xdd, 0x163, 0xb4, 0xad, 0x2dd, 0x2db, 0x2c7, 0x2d8, 0xa7, 0xf7, 0xb8, 0xb0, 0xa8, 0x2d9, 0x171, 0x158, 0x159, 0x25a0, 0xa0];
            const decodeCp852 = (buf) => {
                const bytes = new Uint8Array(buf);
                let out = "";
                for (let i = 0; i < bytes.length; i++) {
                    const b = bytes[i];
                    if (b < 0x80) out += String.fromCharCode(b);
                    else out += String.fromCharCode(CP852_TABLE[b - 0x80]);
                }
                return out;
            };
            // --- CSV beolvasás biztos kódolással (UTF-8 + fallback Windows-1250) ---
            const readFileTextWithEncoding = async (file, encoding) => {
                const buf = await file.arrayBuffer();
                // CP852: egyedi dekóder (TextDecoder nem támogatja megbízhatóan)
                if (String(encoding).toLowerCase() === "cp852") {
                    let txt = decodeCp852(buf);
                    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // BOM remove, ha mégis lenne
                    return txt;
                }
                const dec = new TextDecoder(encoding, { fatal: false });
                let txt = dec.decode(buf);
                if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
                return txt;
            };
            // A dropdownból választott kódolással indulunk
            const preferred = (csvEncodingSelect?.value || "utf-8").toLowerCase();
            // Heurisztika: replacement char + tipikus "félrekódolás" jelek
            const looksBad = (s) => {
                const repl = (s.match(/\uFFFD/g) || []).length;
                const weird = (s.match(/[ˇĄŁ¤]/g) || []).length;
                return (repl >= 2) || (weird >= 2);
            };
            let usedEncoding = preferred;
            let text = await readFileTextWithEncoding(file, preferred);
            // fallback sorrend (a preferred nélkül)
            const fallbacks = ["utf-8", "windows-1250", "iso-8859-2", "cp852"]
                .filter(enc => enc !== preferred);
            if (looksBad(text)) {
                for (const enc of fallbacks) {
                    usedEncoding = enc;
                    text = await readFileTextWithEncoding(file, enc);
                    if (!looksBad(text)) break;
                }
            }
            setImportStatus(`CSV olvasása... (kódolás: ${usedEncoding})`);
            // fallback: ha UTF-8 rossz, először ISO-8859-2, majd Windows-1250
            if (looksBad(text)) {
                usedEncoding = "iso-8859-2";
                text = await readFileTextWithEncoding(file, "iso-8859-2");
            }
            if (looksBad(text)) {
                usedEncoding = "windows-1250";
                text = await readFileTextWithEncoding(file, "windows-1250");
            }
            setImportStatus(`CSV olvasása... (kódolás: ${usedEncoding})`);
            const linesRaw = text
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0);
            if (!text.includes("\t")) {
                setImportStatus("Hiba: a fájl nem TSV (nem tartalmaz tabulátort). Kérlek UTF-8 TSV-t tölts fel.");
                return;
            }
            if (linesRaw.length < 2) {
                setImportStatus("A CSV üres vagy nincs benne adat.");
                return;
            }
            const delimiter = "\t"; // TSV import: fix tabulátor
            const headerCells = parseCsvLine(linesRaw[0], delimiter).map(h => h.trim());
            // sorobjektumok: {header: value}
            const rows = [];
            for (let i = 1; i < linesRaw.length; i++) {
                const cells = parseCsvLine(linesRaw[i], delimiter);
                if (cells.length === 1 && cells[0] === "") continue;
                const o = {};
                for (let c = 0; c < headerCells.length; c++) {
                    o[headerCells[c]] = cells[c] ?? "";
                }
                rows.push(o);
            }
            if (rows.length === 0) {
                setImportStatus("Nincs importálható sor.");
                return;
            }
            // Kötelező minimál mezők: date, amount, title
            // Megpróbáljuk tipikus HU fejléc nevekből kinyerni.
            const toTxPayload = (r) => {
                const monthRaw = pick(r, ["month", "Hónap", "Honap"]);
                const dateRaw = pick(r, ["date", "Dátum", "Datum"]);
                const amountRaw = pick(r, ["amount", "Összeg", "Osszeg"]);
                const titleRaw = pick(r, ["title", "Jogcím", "Jogcim"]);
                const categoryRaw = pick(r, ["category", "Kategória", "Kategoria"]);
                const paymentRaw = pick(r, ["payment_type", "Típus", "Tipus"]);  // pl. "K - OTP - MC"
                const txTypeRaw = pick(r, ["transaction_type", "Jelleg"]);      // "Kiadás" / "Bevétel"
                const statementRaw = pick(r, ["statement_item", "Kivonat sor", "Kivonatsor"]);
                const dateIso = normalizeDateToIso(dateRaw);
                const amountN = parseNumberHu(amountRaw);
                const normalizeMonth = (raw, fallbackDateIso) => {
                    const s = String(raw ?? "").trim();
                    if (!s) return deriveMonth(fallbackDateIso);
                    // 2025-09
                    if (/^\d{4}-\d{2}$/.test(s)) return s;
                    // 2025.09
                    const m1 = s.match(/^(\d{4})\.(\d{2})$/);
                    if (m1) return `${m1[1]}-${m1[2]}`;
                    // 202509
                    const m2 = s.match(/^(\d{4})(\d{2})$/);
                    if (m2) return `${m2[1]}-${m2[2]}`;
                    return deriveMonth(fallbackDateIso);
                };
                return {
                    monthRaw: String(monthRaw || "").trim(),
                    dateIso,
                    amountN,
                    title: String(titleRaw || "").trim(),
                    category: String(categoryRaw || "").trim(),
                    payment_type: String(paymentRaw || "").trim(),
                    transaction_type: String(txTypeRaw || "").trim(),
                    statement_item: String(statementRaw || "").trim(),
                };
            };
            // Importálás batch-ben (valódi batch backend hívással)
            let ok = 0;
            let fail = 0;
            const CSV_BATCH_SIZE = 50;
            // ha a CSV-ben negatív összeg van, az előjelet a "Jelleg" alapján kényszerítjük
            const normalizeSignedAmountFromCsv = (amountN, txType) => {
                const n = Number(amountN);
                if (isNaN(n)) return "";
                const t = String(txType || "").trim().toLowerCase();
                const isExpense = t.includes("kiad"); // Kiadás
                const isIncome = t.includes("bev");  // Bevétel
                const abs = Math.abs(n);
                if (isExpense) return String(-abs);
                if (isIncome) return String(abs);
                // ha nincs jelleg, akkor hagyjuk úgy, ahogy a CSV-ben van
                return String(n);
            };
            for (let i = 0; i < rows.length; i += CSV_BATCH_SIZE) {
                if (csvImportCancelled) {
                    setImportStatus(`Import megszakítva. Sikeres: ${ok}, Hibás/kihagyva: ${fail}.`);
                    break;
                }
                const batchPayloads = [];
                const batchMeta = []; // idx + rawLine a hibákhoz (csak a batchPayloads-hoz tartozó elemek!)
                // batch összeállítása
                for (let j = 0; j < Math.min(CSV_BATCH_SIZE, rows.length - i); j++) {
                    const idx = i + j;
                    const parsed = toTxPayload(rows[idx]);
                    // minimál validáció
                    if (!parsed.dateIso || parsed.amountN == null || !parsed.title) {
                        fail++;
                        importErrors.push({
                            rowNumber: idx + 2, // +1 header, +1 1-indexelt sor
                            phase: "Validáció",
                            reason: `Hiányzó/hibás mező: ${!parsed.dateIso ? "date " : ""}${parsed.amountN == null ? "amount " : ""}${!parsed.title ? "title" : ""}`.trim(),
                            rawLine: linesRaw[idx + 1] || ""
                        });
                        continue;
                    }
                    const month = normalizeMonth(parsed.monthRaw, parsed.dateIso);
                    const signedAmount = normalizeSignedAmountFromCsv(parsed.amountN, parsed.transaction_type);
                    const payload = {
                        date: parsed.dateIso,
                        month,
                        amount: signedAmount,
                        title: parsed.title,
                        category: parsed.category,
                        payment_type: parsed.payment_type,
                        transaction_type: parsed.transaction_type,
                        is_shared: "",          // importnál alapértelmezés: nem megosztott
                        statement_item: parsed.statement_item
                    };
                    batchPayloads.push(payload);
                    batchMeta.push({
                        idx,
                        rawLine: linesRaw[idx + 1] || ""
                    });
                }
                // ha ebben a batch-ben nincs küldhető sor (mind validációs hiba), lépjünk tovább
                if (batchPayloads.length === 0) {
                    setImportStatus(`Import fut... ${ok} sikeres, ${fail} hibás/kihagyva (batch: ${Math.min(i + CSV_BATCH_SIZE, rows.length)}/${rows.length})`);
                    await new Promise(r => setTimeout(r, 30));
                    continue;
                }
                // batch elküldése egyetlen backend hívással (auto-splittelés JSONP hiba esetén)
                async function sendBatchWithSplit(payloads, meta) {
                    // payloads és meta hossza mindig egyezzen!
                    if (!payloads || payloads.length === 0) return;
                    try {
                        const resp = await api.addTransactions(payloads);
                        if (!resp || !resp.success || !Array.isArray(resp.results)) {
                            // válasz hibás -> minden elem hibának számít
                            for (const m of meta) {
                                fail++;
                                importErrors.push({
                                    rowNumber: m.idx + 2,
                                    phase: "API",
                                    reason: resp?.error || "Batch API hiba (hibás válasz).",
                                    rawLine: m.rawLine
                                });
                            }
                            return;
                        }
                        // soronkénti eredmény feldolgozás
                        for (let k = 0; k < resp.results.length; k++) {
                            const r = resp.results[k];
                            const m = meta[k];
                            if (r && r.success) ok++;
                            else {
                                fail++;
                                importErrors.push({
                                    rowNumber: (m?.idx ?? k) + 2,
                                    phase: "API",
                                    reason: r?.error || "Ismeretlen sor-hiba",
                                    rawLine: m?.rawLine || ""
                                });
                            }
                        }
                        return;
                    } catch (err) {
                        const msg = (err && err.message) ? err.message : String(err || "Ismeretlen hiba");
                        // JSONP hiba esetén tipikusan túl hosszú URL / script load fail
                        const isJsonp = String(msg).toLowerCase().includes("jsonp");
                        // Ha már 1 elem is JSONP hibát dob, akkor végleges hiba
                        if (!isJsonp || payloads.length <= 1) {
                            for (const m of meta) {
                                fail++;
                                importErrors.push({
                                    rowNumber: m.idx + 2,
                                    phase: "API",
                                    reason: msg,
                                    rawLine: m.rawLine
                                });
                            }
                            return;
                        }
                        // Felezzük és újrapróbáljuk
                        const mid = Math.ceil(payloads.length / 2);
                        const leftPayloads = payloads.slice(0, mid);
                        const rightPayloads = payloads.slice(mid);
                        const leftMeta = meta.slice(0, mid);
                        const rightMeta = meta.slice(mid);
                        await sendBatchWithSplit(leftPayloads, leftMeta);
                        await sendBatchWithSplit(rightPayloads, rightMeta);
                    }
                }
                // itt hívd meg a batch-re
                await sendBatchWithSplit(batchPayloads, batchMeta);
                setImportStatus(`Import fut... ${ok} sikeres, ${fail} hibás/kihagyva (batch: ${Math.min(i + CSV_BATCH_SIZE, rows.length)}/${rows.length})`);
                // UI „lélegzetvétel”
                await new Promise(r => setTimeout(r, 30));
            }
            setImportStatus(`Import kész. Sikeres: ${ok}, Hibás/kihagyva: ${fail}.`);
            renderImportErrors(importErrors);
            if (cancelImportBtn) cancelImportBtn.style.display = "none";
            // frissítések
            await loadDropdownValues();
            await loadTransactions();
            await loadSharedExpenses();
        } finally {
            // ugyanazt a fájlt is újra ki lehessen választani
            e.target.value = "";
        }
    });
    // ===== Dátum → hónap (csak a tranzakciós formon belül) =====
    const txDateInput = document.querySelector("#txForm input[name='date']");
    const txMonthInput = document.querySelector("#txForm input[name='month']");
    txDateInput?.addEventListener("change", () => {
        if (txDateInput.value && txMonthInput) {
            txMonthInput.value = deriveMonth(txDateInput.value);
        }
    });