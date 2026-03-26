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
function formatDateForList(dateStr) {
    if (!dateStr) return "";

    // Ha már magyar formátumban van (YYYY.MM.DD.), akkor hagyjuk
    if (/^\d{4}\.\d{2}\.\d{2}\.$/.test(dateStr)) {
        return dateStr;
    }
    // Ha YYYY.MM.DD (pont nélkül)
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(dateStr)) {
        return dateStr + ".";
    }
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return dateStr;

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");

    return `${y}.${m}.${d}.`;
}

function parseStatementItemIds(v) {
    // támogatott szeparátorok: vessző, middle dot (·), pontosvessző
    // trim + üresek eldobása
    return String(v ?? "")
        .split(/[,\u00B7;]+/g)
        .map(s => s.trim())
        .filter(Boolean);
}
/**
 * Egyszerű HTML escape biztonságos rendereléshez.
 */
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatHuInteger(v) {
    const n = Math.abs(Number(v) || 0);
    return n.toLocaleString("hu-HU"); // pl. 2000 -> "2 000"
}
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
/**
 * Magyar számformátum normalizálása:
 * "1 234,56" -> 1234.56
 */
function parseNumberHu(raw) {
    const s = String(raw ?? "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/ft/ig, "")
        .replace(",", ".");
    const n = Number(s);
    return isNaN(n) ? null : n;
}
function parseHuNumber(v) {
    const s = String(v ?? "")
        .trim()
        .replace(/\s+/g, "")     // hármas tagolás szóközei
        .replace(/ft/ig, "")     // ha esetleg belekerülne
        .replace(",", ".");      // tizedes vessző támogatás
    return Number(s);
}
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

/**
 * Tipikus dátumformák normalizálása ISO-ra:
 * - YYYY-MM-DD
 * - YYYY.MM.DD
 * - YYYY.MM.DD.
 */
function normalizeDateToIso(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\.?$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    const d = new Date(s);
    if (isNaN(d.getTime())) return "";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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