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
/**
 * Bármilyen dátum inputból (ISO, Date, yyyy-mm-dd) visszaad egy <input type="date"> kompatibilis
 * helyi dátumot: YYYY-MM-DD, időzóna-csúszás nélkül.
 */
function toInputDateLocal(value) {
    if (!value) return "";

    const s = String(value).trim();

    // ha már yyyy-mm-dd, hagyjuk
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(s);
    if (isNaN(d.getTime())) return "";

    // local date -> ISO date (yyyy-mm-dd) időzóna-eltolás korrigálásával
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}
