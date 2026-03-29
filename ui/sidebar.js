document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const content = document.querySelector(".content-wrapper");
    const hamburger = document.getElementById("hamburgerBtn");
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const applyDesktopState = (collapsed) => {
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        sidebar.classList.toggle("collapsed", collapsed);
        content.classList.toggle("sidebar-collapsed", collapsed);
        if (sidebarToggleBtn) {
            sidebarToggleBtn.textContent = collapsed ? "▶" : "◀";
        }
        localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    };
    const isMobile = () => window.matchMedia("(max-width: 700px)").matches;
    // induló állapot (desktopon mentett beállítás)
    if (!isMobile()) {
        // Sidebar state csak akkor, ha már app módban vagyunk (van auth token)
        const hasToken = !!localStorage.getItem("gda_auth_token");
        if (hasToken) {
            const saved = localStorage.getItem("sidebarCollapsed") === "1";
            applyDesktopState(saved);
        }
    }
    // Hamburger: mobilon open/close, desktopon collapsed toggle
    hamburger?.addEventListener("click", () => {
        if (isMobile()) {
            sidebar.classList.toggle("open");
        } else {
            applyDesktopState(!sidebar.classList.contains("collapsed"));
        }
    });
    // Sidebar tetején lévő gomb: desktopon collapsed toggle (mobilon is működhet, de ott inkább a hamburger a UX)
    sidebarToggleBtn?.addEventListener("click", () => {
        if (isMobile()) {
            sidebar.classList.toggle("open");
        } else {
            applyDesktopState(!sidebar.classList.contains("collapsed"));
        }
    });
    // Ha átméretezed az ablakot, a logika ne “ragadjon be”
    window.addEventListener("resize", () => {
        if (isMobile()) {
            // mobil: a collapsed desktop állapotot ne erőltesse
            document.body.classList.remove("sidebar-collapsed");
            sidebar.classList.remove("collapsed");
            content.classList.remove("sidebar-collapsed");
        } else {
            const saved = localStorage.getItem("sidebarCollapsed") === "1";
            applyDesktopState(saved);
            sidebar.classList.remove("open"); // desktopon ne használjuk az "open"-t
        }
    });
});
// Váltás a két panel között
function showPage(page) {
    const txPage = document.getElementById("page-transactions");
    const sharedPage = document.getElementById("page-shared-expenses");
    const bankImportPage = document.getElementById("page-bank-import");
    const valueSetsPage = document.getElementById("page-value-sets");
    const adminPage = document.getElementById("page-admin-users");
    const adminFunctionsPage = document.getElementById("page-admin-functions");
    const adminPermissionsPage = document.getElementById("page-admin-permissions");
    const txBtn = document.getElementById("showTransactionsBtn");
    const sharedBtn = document.getElementById("showSharedExpensesBtn");
    const bankImportBtn = document.getElementById("showBankImportBtn");
    const valueSetsBtn = document.getElementById("showValueSetsBtn");
    const adminBtn = document.getElementById("showAdminUsersBtn");
    const adminFunctionsBtn = document.getElementById("showAdminFunctionsBtn");
    const adminPermissionsBtn = document.getElementById("showAdminPermissionsBtn");
        const hasAccess = (key) => {
        const v = myPermissions?.[key];
        return !!v && String(v).toLowerCase() !== "none";
    };

    if (page === "value-sets" && !hasAccess("value_sets_read")) {
        if (hasAccess("tx_read")) {
            page = "transactions";
        } else if (hasAccess("se_read")) {
            page = "shared";
        } else if (hasAccess("admin_users")) {
            page = "admin-users";
        } else if (hasAccess("admin_functions")) {
            page = "admin-functions";
        } else if (hasAccess("admin_permissions")) {
            page = "admin-permissions";
        } else {
            page = "shared";
        }
    }// mindent elrejt + active reset (minden ismert oldalra/gombra)
    [txPage, sharedPage, bankImportPage, valueSetsPage, adminPage, adminFunctionsPage, adminPermissionsPage]
        .forEach(p => p && p.classList.add("hidden"));
    [txBtn, sharedBtn, bankImportBtn, valueSetsBtn, adminBtn, adminFunctionsBtn, adminPermissionsBtn]
        .forEach(b => b && b.classList.remove("active"));
    if (page === "transactions") {
        txPage?.classList.remove("hidden");
        txBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:transactions"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "shared") {
        sharedPage?.classList.remove("hidden");
        sharedBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:shared"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions(); return;
    }
    if (page === "bank-import") {
        bankImportPage?.classList.remove("hidden");
        bankImportBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:bank-import"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "value-sets") {
        valueSetsPage?.classList.remove("hidden");
        valueSetsBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:value-sets"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "admin-users") {
        adminPage?.classList.remove("hidden");
        adminBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:admin-users"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "admin-functions") {
        adminFunctionsPage?.classList.remove("hidden");
        adminFunctionsBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:admin-functions"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "admin-permissions") {
        adminPermissionsPage?.classList.remove("hidden");
        adminPermissionsBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:admin-permissions"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
}
document.getElementById("showTransactionsBtn").addEventListener("click", () => {
    showPage("transactions");
});
document.getElementById("showSharedExpensesBtn").addEventListener("click", () => {
    showPage("shared");
});
document.getElementById("showBankImportBtn").addEventListener("click", () => {
    showPage("bank-import");
});
document.getElementById("showAdminUsersBtn").addEventListener("click", () => {
    showPage("admin-users");
});
document.getElementById("showAdminFunctionsBtn").addEventListener("click", () => {
    showPage("admin-functions");
});
document.getElementById("showAdminPermissionsBtn").addEventListener("click", () => {
    showPage("admin-permissions");
});
document.getElementById("showValueSetsBtn")?.addEventListener("click", () => {
    showPage("value-sets");
});
function applySidebarPermissions() {
    const txBtn = document.getElementById("showTransactionsBtn");
    const seBtn = document.getElementById("showSharedExpensesBtn");
    const bankImportBtn = document.getElementById("showBankImportBtn");
    const adminUsersBtn = document.getElementById("showAdminUsersBtn");
    const adminFunctionsBtn = document.getElementById("showAdminFunctionsBtn");
    const adminPermissionsBtn = document.getElementById("showAdminPermissionsBtn");
    // Oldalon belüli akciógombok
    const txCreateBtn = document.getElementById("openModalBtn");            // Új tranzakció
    const txImportBtn = document.getElementById("importCsvBtn");            // Import
    const seCreateBtn = document.getElementById("addSharedExpenseBtn");     // + Új megosztott tétel
    const seSettleBtn = document.getElementById("addSettlementInlineBtn");  // + Törlesztés
    // Kényszerített megjelenítés: ne üres stringgel “reseteljünk”, mert az nem mindig hozza vissza
    const setBtnVisible = (btn, visible) => {
        if (!btn) return;
        btn.style.display = visible ? "inline-flex" : "none";
    };
    // A permissions táblában az access tipikusan: none / read / write
    // De UI szempontból: bármi, ami nem "none", hozzáférésnek számít (konzisztens a getLandingPage()-gel)
    const hasAccess = (key) => {
        const v = myPermissions?.[key];
        if (v === undefined || v === null) return false;
        return String(v).trim().toLowerCase() !== "none";
    };
    // RESET: ha korábban el volt rejtve (display:none), most legyen visszaállítva,
    // különben “beragad” és hiába kap jogot, nem jelenik meg.
    [txBtn, seBtn, bankImportBtn, adminUsersBtn, adminFunctionsBtn, adminPermissionsBtn,
        txCreateBtn, txImportBtn, seCreateBtn, seSettleBtn].forEach((b) => {
            if (b) b.style.display = "";
        });
    // Oldal-gombok: ha nincs jog, ne jelenjenek meg
    // Fontos: az oldal akkor is legyen elérhető/látható, ha bármely tx_* / se_* funkcióhoz van jog,
    // nem csak akkor, ha konkrétan tx_read / se_read van kiosztva.
const hasAny = (prefix) =>
    Object.keys(myPermissions || {}).some((k) => k.startsWith(prefix) && hasAccess(k));

// Transactions oldal: a backend getTransactions hívása tx_read jogosultságot vár,
// ezért az oldalmenü láthatóságát is ehhez igazítjuk.
const canSeeTxPage = hasAccess("tx_read");

// Shared Expenses oldal marad prefix-alapú ennél a lépésnél.
const canSeeSePage = hasAny("se_");
    // Oldalmenü – oldal szintű jogosultságok
    if (!canSeeTxPage && txBtn) txBtn.style.display = "none";
    if (!canSeeSePage && seBtn) seBtn.style.display = "none";
    // Bank import: ugyanahhoz a jogosultsághoz kötjük, mint a tranzakció importot
    if (!hasAccess("tx_import") && bankImportBtn) bankImportBtn.style.display = "none";
    // Admin menüpontok – kizárólag saját admin jog alapján
    if (!hasAccess("admin_users") && adminUsersBtn) adminUsersBtn.style.display = "none";
    if (!hasAccess("admin_functions") && adminFunctionsBtn) adminFunctionsBtn.style.display = "none";
    if (!hasAccess("admin_permissions") && adminPermissionsBtn) adminPermissionsBtn.style.display = "none";
    // Transactions akciók
    if (!hasAccess("tx_create") && txCreateBtn) txCreateBtn.style.display = "none";
    if (!hasAccess("tx_import") && txImportBtn) txImportBtn.style.display = "none";
    // Shared Expenses akciók
    if (!hasAccess("se_create") && seCreateBtn) seCreateBtn.style.display = "none";
    if (!hasAccess("se_settlement_create") && seSettleBtn) seSettleBtn.style.display = "none";
    // Transactions akciógombok
    setBtnVisible(txCreateBtn, hasAccess("tx_create"));
    setBtnVisible(txImportBtn, hasAccess("tx_import"));
    // Shared Expenses akciógombok
    setBtnVisible(seCreateBtn, hasAccess("se_create"));
    setBtnVisible(seSettleBtn, hasAccess("se_settlement_create"));
}