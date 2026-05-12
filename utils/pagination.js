// ===============================
// Pagination helpers (shared)
// ===============================
/**
 * Olvassa a per-page select értékét.
 * - Ha "all", akkor pageSize = itemsLength (min. 1)
 * - Ha szám, akkor pageSize = Number(value) (fallback: defaultNumber)
 */
function readPageSize(selectId, itemsLength, defaultNumber = 100) {
    const el = document.getElementById(selectId);
    const raw = el ? String(el.value) : String(defaultNumber);
    if (raw === "all") {
        return Math.max(1, Number(itemsLength) || 0);
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : defaultNumber;
}
/**
 * Kiszámolja a lapozási paramétereket és visszaadja a clamped currentPage-et.
 */
function getPaginationMeta(totalItems, pageSize, currentPage) {
    const total = Math.max(0, Number(totalItems) || 0);
    const size = Math.max(1, Number(pageSize) || 1);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);
    const start = (page - 1) * size;
    const end = start + size;
    return { totalPages, page, start, end };
}
/**
 * UI frissítés: Oldal: X / Y + Találatok: visible / total + gombok tiltása
 */
function updatePaginationUI(cfg, page, totalPages, visibleCount, totalCount) {
    const pageInfoEl = document.getElementById(cfg.pageInfoId);
    if (pageInfoEl) {
        pageInfoEl.textContent = `Oldal: ${page} / ${totalPages}`;
    }
    if (cfg.resultCountId) {
        const rc = document.getElementById(cfg.resultCountId);
        if (rc) rc.textContent = `Találatok: ${visibleCount} / ${totalCount} db`;
    }
    const firstBtn = cfg.firstBtnId ? document.getElementById(cfg.firstBtnId) : null;
    const prevBtn = cfg.prevBtnId ? document.getElementById(cfg.prevBtnId) : null;
    const nextBtn = cfg.nextBtnId ? document.getElementById(cfg.nextBtnId) : null;
    const lastBtn = cfg.lastBtnId ? document.getElementById(cfg.lastBtnId) : null;
    const atFirst = (page <= 1);
    const atLast = (page >= totalPages);
    if (firstBtn) firstBtn.disabled = atFirst;
    if (prevBtn) prevBtn.disabled = atFirst;
    if (nextBtn) nextBtn.disabled = atLast;
    if (lastBtn) lastBtn.disabled = atLast;
}