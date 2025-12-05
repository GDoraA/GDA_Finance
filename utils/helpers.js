// Dátum → YYYY.MM.DD.
function formatDateHU(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}.${mm}.${dd}.`;
}

// Date → YYYYMM hónap
function deriveMonth(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    return `${yyyy}${mm}`;
}

// Amount normalizálása
function normalizeAmount(v) {
    if (!v) return "";
    v = v.replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(v);
    return isNaN(n) ? "" : n.toFixed(2);
}
