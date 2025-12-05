/**
 * Magyar formátum: YYYY.MM.DD.
 */
function formatDateHU(dateStr) {
    if (!dateStr) return "";

    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return dateStr;

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");

    return `${y}.${m}.${d}.`;
}


/**
 * Hónap (YYYYMM) generálása
 */
function deriveMonth(dateStr) {
    if (!dateStr) return "";

    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return "";

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");

    return `${y}${m}`;
}
