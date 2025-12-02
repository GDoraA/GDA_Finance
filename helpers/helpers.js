/* --------------------------------------------------------------------------
   GDA Finance – Segédfüggvények (magyar kommentekkel)
   --------------------------------------------------------------------------
   Ezek a segédfüggvények az app.js és api.js modulok számára nyújtanak
   általános működést:
   - UUID generálás
   - Hónap kinyerése a dátumból
   - ISO timestamp létrehozása
-------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Egyedi ID generálása (UUID)
-------------------------------------------------------------------------- */
function generateId() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback, ha a böngésző régi
    return "uuid-" + Math.random().toString(36).substring(2, 11);
}

/* --------------------------------------------------------------------------
   Hónap kinyerése a dátumból (YYYY-MM)
-------------------------------------------------------------------------- */
function extractMonth(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return year + "-" + month;
}

/* --------------------------------------------------------------------------
   Aktuális idő ISO formátumban (created_at mezőhöz)
-------------------------------------------------------------------------- */
function getTimestamp() {
    return new Date().toISOString();
}

/* --------------------------------------------------------------------------
   Modul export támogatás (ha szükség lenne rá)
-------------------------------------------------------------------------- */
if (typeof module !== "undefined") {
    module.exports = { generateId, extractMonth, getTimestamp };
}
