window.bankMatchingPageBridge = window.bankMatchingPageBridge || {
    resetPage() {
        bankMatchingCurrentPage = 1;
    },
    load(forceRefresh = false) {
        return loadBankMatchingPage(forceRefresh);
    }
};

const bankMatchingIgnoredIds = new Set();
let bankMatchingItemsCache = null;
let bankMatchingItemsCachePromise = null;
let bankMatchingCurrentPage = 1;

const BANK_MATCHING_DEFAULT_PAGE_SIZE = 50;

function getBankMatchingCurrentView() {
    const statusFilterEl = document.getElementById("bankMatchingStatusFilter");
    return String(statusFilterEl?.value || "open").trim().toLowerCase();
}

function setBankMatchingText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

function setBankMatchingStatus(message) {
    const pageEl = document.getElementById("page-bank-matching");
    const statusEl = pageEl?.querySelector("[data-bank-matching-status]");
    if (statusEl) statusEl.textContent = String(message || "");
}
function ensureBankMatchingPaginationControls() {
    const table = document.getElementById("bankMatchingTable");
    if (!table) return null;

    let toolbar = document.getElementById("bankMatchingPaginationToolbar");
    if (toolbar) return toolbar;

    toolbar = document.createElement("div");
    toolbar.id = "bankMatchingPaginationToolbar";
    toolbar.className = "tx-toolbar";
    toolbar.style.marginBottom = "10px";

    toolbar.innerHTML = `
        <div class="tx-toolbar-left">
            <label for="bankMatchingItemsPerPage">Tételek oldalanként:</label>
            <select id="bankMatchingItemsPerPage">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="all">Összes</option>
            </select>
        </div>

        <div id="bankMatchingResultCount" class="result-count"></div>

        <div id="bankMatchingPagination" class="pagination">
            <button id="bankMatchingFirstPageBtn" type="button" class="page-btn" aria-label="Első oldal">⏮</button>
            <button id="bankMatchingPrevPageBtn" type="button" class="page-btn" aria-label="Előző oldal">◀</button>
            <span id="bankMatchingPageInfo" class="page-info"></span>
            <button id="bankMatchingNextPageBtn" type="button" class="page-btn" aria-label="Következő oldal">▶</button>
            <button id="bankMatchingLastPageBtn" type="button" class="page-btn" aria-label="Utolsó oldal">⏭</button>
        </div>
    `;

    table.parentNode.insertBefore(toolbar, table);

    document.getElementById("bankMatchingItemsPerPage")?.addEventListener("change", () => {
        bankMatchingCurrentPage = 1;
        renderBankMatchingPageFromCache();
    });

    document.getElementById("bankMatchingFirstPageBtn")?.addEventListener("click", () => {
        bankMatchingCurrentPage = 1;
        renderBankMatchingPageFromCache();
    });

    document.getElementById("bankMatchingPrevPageBtn")?.addEventListener("click", () => {
        bankMatchingCurrentPage = Math.max(1, bankMatchingCurrentPage - 1);
        renderBankMatchingPageFromCache();
    });

    document.getElementById("bankMatchingNextPageBtn")?.addEventListener("click", () => {
        bankMatchingCurrentPage += 1;
        renderBankMatchingPageFromCache();
    });

    document.getElementById("bankMatchingLastPageBtn")?.addEventListener("click", () => {
        const totalPages = Number(
            document.getElementById("bankMatchingPagination")?.dataset.totalPages || "1"
        );

        bankMatchingCurrentPage = Math.max(1, totalPages);
        renderBankMatchingPageFromCache();
    });

    return toolbar;
}

function getBankMatchingPageSize(totalItems) {
    const select = document.getElementById("bankMatchingItemsPerPage");
    const raw = String(select?.value || BANK_MATCHING_DEFAULT_PAGE_SIZE);

    if (raw === "all") {
        return Math.max(1, Number(totalItems) || 0);
    }

    const n = Number(raw);
    return Number.isFinite(n) && n > 0
        ? n
        : BANK_MATCHING_DEFAULT_PAGE_SIZE;
}

function updateBankMatchingPaginationUI(page, totalPages, visibleCount, totalCount) {
    const pagination = document.getElementById("bankMatchingPagination");
    const resultCount = document.getElementById("bankMatchingResultCount");
    const pageInfo = document.getElementById("bankMatchingPageInfo");

    if (pagination) {
        pagination.dataset.totalPages = String(totalPages);
        pagination.style.display = totalPages > 1 ? "flex" : "none";
    }

    if (resultCount) {
        resultCount.textContent = `Találatok: ${visibleCount} / ${totalCount} db`;
    }

    if (pageInfo) {
        pageInfo.textContent = `Oldal: ${page} / ${totalPages}`;
    }

    const atFirst = page <= 1;
    const atLast = page >= totalPages;

    const firstBtn = document.getElementById("bankMatchingFirstPageBtn");
    const prevBtn = document.getElementById("bankMatchingPrevPageBtn");
    const nextBtn = document.getElementById("bankMatchingNextPageBtn");
    const lastBtn = document.getElementById("bankMatchingLastPageBtn");

    if (firstBtn) firstBtn.disabled = atFirst;
    if (prevBtn) prevBtn.disabled = atFirst;
    if (nextBtn) nextBtn.disabled = atLast;
    if (lastBtn) lastBtn.disabled = atLast;
}
function findBankMatchingCachedItem(bankId) {
    const id = String(bankId || "").trim();
    if (!id || !Array.isArray(bankMatchingItemsCache)) return null;

    return bankMatchingItemsCache.find(item =>
        String(item?.id || "").trim() === id
    ) || null;
}

function setBankMatchingCachedStatus(bankId, status) {
    const item = findBankMatchingCachedItem(bankId);
    if (!item) return null;

    const previousStatus = String(item?.match_status || "").trim();
    item.match_status = String(status || "").trim();
    return previousStatus;
}

function initBankMatchingStatusFilter() {
    const statusFilterEl = document.getElementById("bankMatchingStatusFilter");
    const hideInternalTransfersEl = document.getElementById("bankMatchingHideInternalTransfers");

    if (statusFilterEl && statusFilterEl.dataset.initialized !== "1") {
        statusFilterEl.addEventListener("change", () => {
            bankMatchingCurrentPage = 1;
            renderBankMatchingPageFromCache();
        });

        statusFilterEl.dataset.initialized = "1";
    }

    if (hideInternalTransfersEl && hideInternalTransfersEl.dataset.initialized !== "1") {
        hideInternalTransfersEl.addEventListener("change", () => {
            bankMatchingCurrentPage = 1;
            renderBankMatchingPageFromCache();
        });

        hideInternalTransfersEl.dataset.initialized = "1";
    }
}

async function ensureBankMatchingItemsCache(forceRefresh = false) {
    if (!forceRefresh && Array.isArray(bankMatchingItemsCache)) {
        return bankMatchingItemsCache;
    }

    if (!forceRefresh && bankMatchingItemsCachePromise) {
        return bankMatchingItemsCachePromise;
    }

    bankMatchingItemsCachePromise = (async () => {
        const resp = await api.getBankTransactions();

        if (!resp || resp.success !== true || !Array.isArray(resp.data)) {
            throw new Error(resp?.error || resp?.message || "Hibás banki adatválasz.");
        }

        bankMatchingItemsCache = resp.data;
        return bankMatchingItemsCache;
    })();

    try {
        return await bankMatchingItemsCachePromise;
    } finally {
        bankMatchingItemsCachePromise = null;
    }
}

function renderBankMatchingPageFromCache() {
    const bankItems = Array.isArray(bankMatchingItemsCache) ? bankMatchingItemsCache : [];
    const currentView = getBankMatchingCurrentView();

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

    setBankMatchingText("bankMatchingTotal", total);
    setBankMatchingText("bankMatchingMatched", matched);
    setBankMatchingText("bankMatchingOpen", open);
    setBankMatchingText("bankMatchingIgnored", ignored);
    setBankMatchingText("bankMatchingRatio", `${ratio}%`);

    const tableBody = document.getElementById("bankMatchingTableBody");
    if (!tableBody) {
        setBankMatchingStatus(
            currentView === "ignored"
                ? "Ignored nézet betöltve."
                : "Open nézet betöltve."
        );
        return;
    }

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

let visibleItems = currentView === "ignored"
    ? ignoredItems
    : openItems;

const hideInternalTransfers =
    document.getElementById("bankMatchingHideInternalTransfers")?.checked === true;

let hiddenInternalCount = 0;

if (hideInternalTransfers) {
    const ownList = (typeof window !== "undefined" && Array.isArray(window.__ownAccountsCache))
        ? window.__ownAccountsCache
        : [];

    const normAcc = (s) => String(s ?? "").replace(/\s+/g, "").trim().toLowerCase();
    const ownSet = new Set(ownList.map(normAcc).filter(Boolean));

    const classifyDir = (dirRaw, amt) => {
        const d = String(dirRaw ?? "").trim().toLowerCase();

        if (d === "bejövő" || d === "bejövo") return "in";
        if (d === "kimenő" || d === "kimeno") return "out";

        if (d === "credit" || d === "cr" || d === "c") return "in";
        if (d === "debit" || d === "dr" || d === "d") return "out";

        if (typeof amt === "number") {
            if (amt < 0) return "out";
            if (amt > 0) return "in";
        }

        return "";
    };

    const flagsByAbsAmount = new Map();

    for (const item of visibleItems) {
        const amt = normalizeAmount(item?.amount);
        if (typeof amt !== "number") continue;

        const acc1 = normAcc(item?.account_number);
        const acc2 = normAcc(item?.partner_account);
        const touchesOwn = ownSet.has(acc1) || ownSet.has(acc2);

        if (!touchesOwn) continue;

        const dirClass = classifyDir(item?.direction, amt);
        if (!dirClass) continue;

        const absAmt = Math.abs(amt);

        if (!flagsByAbsAmount.has(absAmt)) {
            flagsByAbsAmount.set(absAmt, { in: false, out: false });
        }

        const rec = flagsByAbsAmount.get(absAmt);

        if (dirClass === "in") {
            rec.in = true;
        } else if (dirClass === "out") {
            rec.out = true;
        }
    }

    const internalAbsAmounts = new Set(
        Array.from(flagsByAbsAmount.entries())
            .filter(([_, v]) => v.in && v.out)
            .map(([amount]) => amount)
    );

    visibleItems = visibleItems.filter((item) => {
        const amt = normalizeAmount(item?.amount);
        if (typeof amt !== "number") return true;

        const acc1 = normAcc(item?.account_number);
        const acc2 = normAcc(item?.partner_account);
        const touchesOwn = ownSet.has(acc1) || ownSet.has(acc2);

        if (!touchesOwn) return true;

        const isInternal = internalAbsAmounts.has(Math.abs(amt));

        if (isInternal) {
            hiddenInternalCount += 1;
            return false;
        }

        return true;
    });
}

const hideInternalCb = document.getElementById("bankMatchingHideInternalTransfers");
const hideInternalLabel = hideInternalCb?.closest("label");

if (hideInternalLabel) {
    const baseText = "Saját számlák közti utalások elrejtése";
    const newText =
        hideInternalTransfers && hiddenInternalCount > 0
            ? ` ${baseText} (${hiddenInternalCount} elrejtve)`
            : ` ${baseText}`;

    Array.from(hideInternalLabel.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            hideInternalLabel.removeChild(node);
        }
    });

    hideInternalLabel.appendChild(document.createTextNode(newText));
}

ensureBankMatchingPaginationControls();

const pageSize = getBankMatchingPageSize(visibleItems.length);
const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
    bankMatchingCurrentPage = Math.min(
        Math.max(Number(bankMatchingCurrentPage) || 1, 1),
        totalPages
    );

    const start = (bankMatchingCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = visibleItems.slice(start, end);

    updateBankMatchingPaginationUI(
        bankMatchingCurrentPage,
        totalPages,
        pageItems.length,
        visibleItems.length
    );

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
tableBody.innerHTML = pageItems.map((item) => {
    const bankId = String(item?.id || "");
    const memo = String(item?.memo || "");
    const partnerName = String(item?.partner_name || "");
    const statusLabel = currentView === "ignored" ? "Ignored" : "Open";

    return `
        <tr>
            <td>${escapeHtml(bankId)}</td>
            <td>${escapeHtml(String(item?.month || ""))}</td>
            <td>${escapeHtml(String(item?.transaction_date || ""))}</td>
            <td>${escapeHtml(String(item?.posting_date || ""))}</td>
            <td class="text-right">${escapeHtml(formatAmount(item?.amount || ""))}</td>
            <td>${escapeHtml(String(item?.direction || ""))}</td>
            <td title="${escapeHtml(partnerName)}">${escapeHtml(partnerName)}</td>
            <td title="${escapeHtml(memo)}">${escapeHtml(memo)}</td>
            <td>${escapeHtml(statusLabel)}</td>
            <td>
                <button type="button"
                        class="${currentView === "ignored" ? "bank-matching-restore-btn" : "bank-matching-ignore-btn"}"
                        data-bank-id="${escapeHtml(bankId)}">
                    ${currentView === "ignored" ? "Visszaállítás" : "Nem kell párosítani"}
                </button>
            </td>
        </tr>
    `;
}).join("");
    }

    bindBankMatchingRowActions(tableBody);

setBankMatchingStatus(
    currentView === "ignored"
        ? `Ignored nézet betöltve. (${pageItems.length} / ${visibleItems.length} tétel)`
        : `Open nézet betöltve. (${pageItems.length} / ${visibleItems.length} tétel)`
);
}

function bindBankMatchingRowActions(tableBody) {
    tableBody.querySelectorAll(".bank-matching-ignore-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const bankId = String(btn.dataset.bankId || "").trim();
            if (!bankId) return;

            const previousStatus = setBankMatchingCachedStatus(bankId, "ignored");
            bankMatchingIgnoredIds.add(bankId);
            renderBankMatchingPageFromCache();

            try {
                const resp = await api.setBankTransactionMatchStatus(bankId, "ignored");

                if (!resp || resp.success !== true) {
                    setBankMatchingCachedStatus(bankId, previousStatus || "");
                    bankMatchingIgnoredIds.delete(bankId);
                    renderBankMatchingPageFromCache();
                    alert(resp?.error || resp?.message || "Nem sikerült menteni a státuszt.");
                    return;
                }
            } catch (err) {
                console.error("Bank matching status save error:", err);
                setBankMatchingCachedStatus(bankId, previousStatus || "");
                bankMatchingIgnoredIds.delete(bankId);
                renderBankMatchingPageFromCache();
                alert("Hiba történt a státusz mentésekor.");
            }
        });
    });

    tableBody.querySelectorAll(".bank-matching-restore-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const bankId = String(btn.dataset.bankId || "").trim();
            if (!bankId) return;

            const previousStatus = setBankMatchingCachedStatus(bankId, "open");
            bankMatchingIgnoredIds.delete(bankId);
            renderBankMatchingPageFromCache();

            try {
                const resp = await api.setBankTransactionMatchStatus(bankId, "open");

                if (!resp || resp.success !== true) {
                    setBankMatchingCachedStatus(bankId, previousStatus || "ignored");
                    bankMatchingIgnoredIds.add(bankId);
                    renderBankMatchingPageFromCache();
                    alert(resp?.error || resp?.message || "Nem sikerült visszaállítani a státuszt.");
                    return;
                }
            } catch (err) {
                console.error("Bank matching status restore error:", err);
                setBankMatchingCachedStatus(bankId, previousStatus || "ignored");
                bankMatchingIgnoredIds.add(bankId);
                renderBankMatchingPageFromCache();
                alert("Hiba történt a státusz visszaállításakor.");
            }
        });
    });
}

async function loadBankMatchingPage(forceRefresh = false) {
    initBankMatchingStatusFilter();

    const pageEl = document.getElementById("page-bank-matching");
    if (!pageEl) return;

    setBankMatchingStatus("Adatok betöltése...");

try {
    if (typeof window.ensureOwnAccountsCache === "function") {
        await window.ensureOwnAccountsCache();
    }

    await ensureBankMatchingItemsCache(forceRefresh);
    renderBankMatchingPageFromCache();
} catch (err) {
        console.error("Bank matching load error:", err);

        bankMatchingItemsCache = null;

        setBankMatchingText("bankMatchingTotal", 0);
        setBankMatchingText("bankMatchingMatched", 0);
        setBankMatchingText("bankMatchingOpen", 0);
        setBankMatchingText("bankMatchingIgnored", 0);
        setBankMatchingText("bankMatchingRatio", "0%");

        const tableBody = document.getElementById("bankMatchingTableBody");
        if (tableBody) {
            tableBody.innerHTML = `
<tr>
<td colspan="10">Hiba a banki adatok betöltésekor.</td>
</tr>
`;
        }

        setBankMatchingStatus("Hiba a banki adatok betöltésekor.");
    }
}