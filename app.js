document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("page:shared", () => {
        loadSharedExpenses();
    });
    document.addEventListener("page:bank-import", () => {
        loadBankTransactions();
    });
    document.addEventListener("page:value-sets", () => {
        typeof loadValueSetsPage === "function" && loadValueSetsPage();
    });
    document.addEventListener("page:own-accounts", () => {
        typeof loadOwnAccounts === "function" && loadOwnAccounts();
    });
    document.addEventListener("page:admin-users", () => {
        typeof loadAdminUsers === "function" && loadAdminUsers();
    });
    document.addEventListener("page:admin-functions", () => {
        typeof loadAdminFunctions === "function" && loadAdminFunctions();
    });
    document.addEventListener("page:admin-permissions", () => {
        typeof loadAdminPermissions === "function" && loadAdminPermissions();
    });
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
    // egyszerű HTML escape (biztonság + stabil render)
    const escapeHtml = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

    // Normalizálás: "1 234,56" -> 1234.56
    const parseNumberHu = (raw) => {
        const s = String(raw ?? "")
            .trim()
            .replace(/\s+/g, "")
            .replace(/ft/ig, "")
            .replace(",", ".");
        const n = Number(s);
        return isNaN(n) ? null : n;
    };

    // Dátum parse: támogatott tipikus formák: YYYY-MM-DD, YYYY.MM.DD, YYYY.MM.DD.
    const normalizeDateToIso = (raw) => {
        const s = String(raw ?? "").trim();
        if (!s) return "";

        // már ISO
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

        // YYYY.MM.DD vagy YYYY.MM.DD.
        const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\.?$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;

        // fallback: Date konstruktor (ha mégis felismeri)
        const d = new Date(s);
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
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

    // ===== Datalist betöltés =====
    loadDropdownValues();


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







});

// ======================================================
// FORMÁZÓ FÜGGVÉNYEK – DÁTUM, ÖSSZEG
// ======================================================
function formatAmount(amount) {
    if (amount === null || amount === undefined) return "";

    // szóközök eltávolítása, majd számmá alakítás
    const num = Number(String(amount).replace(/\s/g, ""));
    if (isNaN(num)) {
        // ha nem értelmezhető számként, akkor eredeti értéket adjuk vissza
        return String(amount);
    }
    // ez teszi bele a szóközöket ezres csoportosítással
    return Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function formatSignedAmount(amount) {
    if (amount === null || amount === undefined) return "";

    const num = Number(String(amount).replace(/\s/g, ""));
    if (isNaN(num)) return String(amount);

    const sign = num < 0 ? "-" : "";
    return sign + formatAmount(Math.abs(num));
}
// ======================================================
// DATALIST ÉRTÉKEK BETÖLTÉSE
// ======================================================
async function loadDropdownValues() {
    const result = await api.getValueSets();
    if (!result || !result.success) return;
    const sets = result.sets;
    // Modal datalist-ek
    fillDatalist("titlesList", sets.titles);
    fillDatalist("sharedTitlesList", sets.titles);
    fillDatalist("categoriesList", sets.categories);
    fillDatalist("paymentTypesList", sets.payments);
    fillDatalist("transactionTypesList", sets.types);
    fillDatalist("paidByList", sets.paid_by || []);
    // Új értékkészlet a fizető felekhez
    fillDatalist("paidByList", sets.paid_by || []);
    // Szűrő datalist-ek
    fillDatalist("filterTitlesList", sets.titles);
    fillDatalist("filterCategoriesList", sets.categories);
    fillDatalist("filterPaymentsList", sets.payments);
    fillDatalist("filterTypesList", sets.types);
}
function fillDatalist(listId, values) {
    const dl = document.getElementById(listId);
    if (!dl) return;
    dl.innerHTML = "";
    values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
    });
}
// ======================================================
// LISTÁZÁS & SZŰRÉS
// ======================================================
let txCurrentPage = 1;
let txSortField = "date";
let txSortDirection = "desc"; // "asc" | "desc"
let seSortField = "date";
let seSortDirection = "desc";
let seRowsById = new Map(); // shared expense rekord cache id alapján
let bankCurrentPage = 1;
let bankSortField = "transaction_date";
let bankSortDirection = "desc";
let bankFilterTextDebounce = null;

// ===== Bank_Transactions cache (Transactions modal dropdownhoz) =====
let myPermissions = {};
const toIsoDate = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const m1 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
function buildStatementItemOptions(tx, bankItems) {
    const rawTxDate = String(tx?.date ?? "").trim();
    const txDateIso = rawTxDate.includes("T") ? rawTxDate.split("T")[0] : toInputDateLocal(rawTxDate);
    const txAmt = Number(tx?.amount);
    const matches = (bankItems || []).filter(b => {
        const bDateIso = String(b?.transaction_date ?? "").trim();
        const bAmt = Number(b?.amount);
        if (!txDateIso) return false;
        if (!bDateIso) return false;
        if (Number.isNaN(txAmt) || Number.isNaN(bAmt)) return false;
        return (bDateIso === txDateIso) && (Math.abs(bAmt) === Math.abs(txAmt));
    });
    // opció szöveg: id + partner + memo (ha van)
    const opts = [
        `<option value="">— válassz banki tételt —</option>`,
        ...matches.map(b => {
            const id = String(b?.id ?? "").trim();
            const partner = String(b?.partner_name ?? "").trim();
            const memo = String(b?.memo ?? "").trim();
            const label = [id, partner, memo].filter(Boolean).join(" | ");
            return `<option value="${id}">${label || id}</option>`;
        })
    ];
    return opts.join("");
}

function buildStatementItemSelectHtml(tx) {
    // statement_item = kiválasztott bank tranzakció id (string)
    const selectedId = String(tx?.statement_item ?? "").trim();
    // dropdown alapból üres opciókkal (később töltjük async)
    // fontos: a táblázat renderelése szinkron, ezért az async betöltést utólag végezzük
    const safeTxId = String(tx?.id ?? "").trim();
    // Egyedi azonosító, hogy később megtaláljuk és feltöltsük
    const selectId = `stmt_${safeTxId}`;
    // Placeholder: amíg a bankTxCache be nem jön
    return `
  <button type="button"
          id="${selectId}"
          class="statement-item-picker-btn"
          data-tx-id="${safeTxId}">
    ${selectedId ? `#${selectedId}` : "Banki tétel kiválasztása"}
  </button>
  <div class="statement-item-picker-popover" id="${selectId}_pop" data-open="0"></div>
`;
}


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
let valueSetsSort = { field: "value", dir: "asc" };
let valueSetsPage = 1;
function renderValueSetsTable(list) {
    const tbody = document.querySelector("#valueSetsTable tbody");
    const filterInput = document.getElementById("valueSetFilterText");
    const itemsPerPageSelect = document.getElementById("valueSetItemsPerPage");
    const pagination = document.getElementById("valueSetsPagination");
    if (!tbody) return;
    let items = Array.isArray(list) ? list : [];
    // SZŰRÉS
    const filter = (filterInput?.value || "").toLowerCase().trim();
    if (filter) {
        items = items.filter(v => String(v ?? "").toLowerCase().includes(filter));
    }
    // RENDEZÉS
    items.sort((a, b) => {
        const av = String(a ?? "").toLowerCase();
        const bv = String(b ?? "").toLowerCase();
        if (av < bv) return valueSetsSort.dir === "asc" ? -1 : 1;
        if (av > bv) return valueSetsSort.dir === "asc" ? 1 : -1;
        return 0;
    });
    // LAPOZÁS
    const itemsPerPage = Math.max(1, Number(itemsPerPageSelect?.value || 20));
    const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
    if (valueSetsPage > totalPages) valueSetsPage = totalPages;
    const start = (valueSetsPage - 1) * itemsPerPage;
    const pagedItems = items.slice(start, start + itemsPerPage);
    tbody.innerHTML = pagedItems
        .map(v => `<tr><td>${escapeHtml(String(v ?? "").trim())}</td></tr>`)
        .join("");
    const resultCount = document.getElementById("valueSetResultCount");
    if (resultCount) {
        resultCount.textContent = `${items.length} érték • ${valueSetsPage}/${totalPages} oldal`;
    }
    if (pagination) {
        pagination.innerHTML = `
            <button type="button" ${valueSetsPage <= 1 ? "disabled" : ""} data-page="prev">Előző</button>
            <span>${valueSetsPage} / ${totalPages}</span>
            <button type="button" ${valueSetsPage >= totalPages ? "disabled" : ""} data-page="next">Következő</button>
        `;
        pagination.querySelector('[data-page="prev"]')?.addEventListener("click", () => {
            if (valueSetsPage > 1) {
                valueSetsPage--;
                renderValueSetsTable(list);
            }
        });
        pagination.querySelector('[data-page="next"]')?.addEventListener("click", () => {
            if (valueSetsPage < totalPages) {
                valueSetsPage++;
                renderValueSetsTable(list);
            }
        });
    }
}
async function loadValueSetsPage() {
    const categorySelect = document.getElementById("valueSetCategorySelect");
    const resultCount = document.getElementById("valueSetResultCount");
    if (!categorySelect) return;
    const res = await api.getValueSetsDetailed();
    if (!res || !res.success) {
        if (resultCount) resultCount.textContent = "Nem sikerült betölteni az értékkészleteket.";
        return;
    }
    const categories = Array.isArray(res.categories) ? res.categories : [];
    const itemsByCategory = res.itemsByCategory || {};
    if (!categorySelect.dataset.initialized) {
        categorySelect.innerHTML = categories
            .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("");
        const filterInput = document.getElementById("valueSetFilterText");
        if (filterInput && !filterInput.dataset.initialized) {
            filterInput.addEventListener("input", () => {
                valueSetsPage = 1;
                const selected = categorySelect.value;
                const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
                renderValueSetsTable(list);
            });
            filterInput.dataset.initialized = "1";
        }
        const itemsPerPageSelect = document.getElementById("valueSetItemsPerPage");
        if (itemsPerPageSelect && !itemsPerPageSelect.dataset.initialized) {
            itemsPerPageSelect.addEventListener("change", () => {
                valueSetsPage = 1;
                const selected = categorySelect.value;
                const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
                renderValueSetsTable(list);
            });
            itemsPerPageSelect.dataset.initialized = "1";
        }
        categorySelect.addEventListener("change", () => {
            valueSetsPage = 1;
            const selected = categorySelect.value;
            const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
            renderValueSetsTable(list);
        });
        categorySelect.dataset.initialized = "1";
    }
    const selected = categorySelect.value || categories[0] || "";
    if (selected && !categorySelect.value) {
        categorySelect.value = selected;
    }
    const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
    renderValueSetsTable(list);
    const th = document.querySelector("#valueSetsTable thead th[data-sort]");
    if (th && !th.dataset.initialized) {
        th.addEventListener("click", () => {
            valueSetsSort.dir = valueSetsSort.dir === "asc" ? "desc" : "asc";
            const categorySelect = document.getElementById("valueSetCategorySelect");
            const selected = categorySelect?.value;
            const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
            renderValueSetsTable(list);
        });
        th.dataset.initialized = "1";
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
async function loadAdminUsers() {
    const tbody = document.getElementById("adminUsersBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const resp = await api.getUsers();

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="4">Nincs jogosultság vagy hiba: ${resp?.error || "ismeretlen"}</td></tr>`;
        return;
    }

    const users = resp.users || [];
    for (const u of users) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(u.name || "")}</td>
            <td>${escapeHtml(u.email || "")}</td>
            <td>${escapeHtml(u.app_access || "")}</td>
            <td>${escapeHtml(u.is_admin || "")}</td>
        `;
        tbody.appendChild(tr);
    }
}
async function loadAdminFunctions() {
    const tbody = document.getElementById("adminFunctionsBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getFunctions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3">Hiba a funkciók betöltésekor</td></tr>`;
        return;
    }

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság vagy hiba: ${resp?.error || "ismeretlen"}</td></tr>`;
        return;
    }

    const functions = resp.functions || [];
    for (const fn of functions) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(fn.function_key || "")}</td>
            <td>${escapeHtml(fn.name || "")}</td>
            <td>${escapeHtml(fn.description || "")}</td>
        `;
        tbody.appendChild(tr);
    }
}
async function loadAdminPermissions() {
    const tbody = document.getElementById("adminPermissionsBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getPermissions();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3">Hiba a jogosultságok betöltésekor</td></tr>`;
        return;
    }

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság vagy hiba: ${resp?.error || "ismeretlen"}</td></tr>`;
        return;
    }

    const rows = resp.permissions || [];
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság beállítás</td></tr>`;
        return;
    }

    for (const r of rows) {
        const tr = document.createElement("tr");
        const current = String(r.access || "").toLowerCase();
        const val = (["none", "read", "write"].includes(current) ? current : "none");

        tr.innerHTML = `
            <td>${escapeHtml(r.email || "")}</td>
            <td>${escapeHtml(r.function_key || "")}</td>
            <td>
              <select class="perm-access" data-email="${escapeHtml(r.email || "")}" data-function="${escapeHtml(r.function_key || "")}">
                <option value="none" ${val === "none" ? "selected" : ""}>none</option>
                <option value="read" ${val === "read" ? "selected" : ""}>read</option>
                <option value="write" ${val === "write" ? "selected" : ""}>write</option>
              </select>
            </td>
        `;
        tbody.querySelectorAll("select.perm-access").forEach(sel => {
            sel.addEventListener("change", async () => {
                const email = sel.getAttribute("data-email");
                const function_key = sel.getAttribute("data-function");
                const access = sel.value;

                try {
                    const resp = await api.setPermission(email, function_key, access);
                    if (!resp || !resp.success) {
                        alert("Nem sikerült menteni a jogosultságot.");
                    }
                } catch (e) {
                    alert("Hiba a jogosultság mentésekor.");
                }
            });
        });

        tbody.appendChild(tr);
    }
}

// egyszerű HTML escape (ha nincs már ilyen helpered máshol)
function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
}

document.getElementById("adminUserForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("adminUserName")?.value?.trim() || "";
    const email = document.getElementById("adminUserEmail")?.value?.trim() || "";

    const msg = document.getElementById("adminUserMsg");
    if (msg) { msg.style.display = "none"; msg.className = "msg"; msg.textContent = ""; }

    const resp = await api.addUser(name, email);

    if (!resp || !resp.success) {
        if (msg) {
            msg.style.display = "block";
            msg.className = "msg error";
            msg.textContent = resp?.error || "Hiba történt.";
        }
        return;
    }

    // reset + újratöltés
    document.getElementById("adminUserName").value = "";
    document.getElementById("adminUserEmail").value = "";

    if (msg) {
        msg.style.display = "block";
        msg.className = "msg success";
        msg.textContent = "Felhasználó hozzáadva.";
    }

    await loadAdminUsers();
});

function parseHuNumber(v) {
    const s = String(v ?? "")
        .trim()
        .replace(/\s+/g, "")     // hármas tagolás szóközei
        .replace(/ft/ig, "")     // ha esetleg belekerülne
        .replace(",", ".");      // tizedes vessző támogatás
    return Number(s);
}

function formatHuInteger(v) {
    const n = Math.abs(Number(v) || 0);
    return n.toLocaleString("hu-HU"); // pl. 2000 -> "2 000"
}
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
});

// ===== Shared Expenses – Event Delegation =====
document.getElementById("sharedExpensesBody").addEventListener("change", async (e) => {
    const target = e.target;
    const rowId = target?.getAttribute("data-id") || "";

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
        await api.updateSharedExpense(rowId, "paid_by", value);
        // value set frissítés, ha új elem
        const valueSets = await api.getValueSets();
        const existing = valueSets.sets.paid_by.map(v => v.toLowerCase());
        if (!existing.includes(value.toLowerCase())) {
            await api.addValueToSet("paid_by", value);
        }
        await loadSharedExpenses();
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

    // amount a 4. oszlopban (index 3) van: "12 345 Ft"
    const amountText = (tr.children[3]?.textContent || "").replace(/\s/g, "");
    const amount = Math.abs(Number(amountText.replace("Ft", "").replace(",", ".")) || 0);

    // paid_by az 5. oszlopban (index 4)
    const paidBy = (tr.children[4]?.textContent || "").trim().toLowerCase();

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

    const response = await api.addSharedExpense({
        month,
        date,
        title,                 // ne legyen fix "Törlesztés"
        amount,
        paid_by: paidBy,
        Zsolti_amount: zsoltiAmount,  // <-- ezt küldjük, ne 0-t
        Dori_amount: doriAmount,      // <-- ezt küldjük, ne 0-t
        notes
    });




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

        <!-- Egyenleg (lila) -->
        <td class="balance-settlement set-balance-preview">0</td>

        <!-- Megjegyzés + gombok -->
        <td>
            <input type="text" class="set-notes" placeholder="Megjegyzés" style="margin-bottom:10px;">
            <div class="settlement-actions">
                <button type="button" class="btn-primary save-settlement">Mentés</button>
                <button type="button" class="btn-secondary cancel-settlement">Mégse</button>
            </div>
        </td>
    `;

    tbody.prepend(tr);

    // Élő előnézet az Egyenleg cellában
    const amountInput = tr.querySelector(".set-amount");
    const previewCell = tr.querySelector(".set-balance-preview");
    amountInput.addEventListener("input", () => {
        const n = Math.abs(Number(amountInput.value) || 0);
        previewCell.textContent = formatAmount(n);
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
    const response = await api.addSharedExpense({
        month,
        date,
        title: title || "Törlesztés",
        amount,
        paid_by: paidBy,
        Zsolti_amount: 0,
        Dori_amount: 0,
        settlement: "x",   // <-- ettől lesz speciális számítás a backendben
        notes
    });

    if (!response || !response.success) {
        console.error("addSharedExpense (settlement) FAILED:", response);
        alert(response?.error || response?.message || "Hiba történt a törlesztés mentésekor.");
        return;
    }


    tr.remove();
    await loadSharedExpenses();
}

