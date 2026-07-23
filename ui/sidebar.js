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

    // Sidebar bezárása / összecsukása, ha a felhasználó a menün kívülre kattint
    document.addEventListener("click", (event) => {
        const target = event.target;

        const clickedInsideSidebar = sidebar.contains(target);
        const clickedHamburger = hamburger?.contains(target);
        const clickedSidebarToggle = sidebarToggleBtn?.contains(target);

        if (clickedInsideSidebar || clickedHamburger || clickedSidebarToggle) return;

        if (isMobile()) {
            if (sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
            }
            return;
        }

        if (!sidebar.classList.contains("collapsed")) {
            applyDesktopState(true);
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
    const pages = {
        "transactions": {
            pageEl: document.getElementById("page-transactions"),
            btnEl: document.getElementById("showTransactionsBtn"),
            eventName: "page:transactions"
        },
        "shared": {
            pageEl: document.getElementById("page-shared-expenses"),
            btnEl: document.getElementById("showSharedExpensesBtn"),
            eventName: "page:shared"
        },
        "bank-import": {
            pageEl: document.getElementById("page-bank-import"),
            btnEl: document.getElementById("showBankImportBtn"),
            eventName: "page:bank-import"
        },
        "reports-monthly": {
            pageEl: document.getElementById("page-reports-monthly"),
            btnEl: document.getElementById("showReportsMonthlyBtn"),
            eventName: "page:reports-monthly"
        },
        "reports-house-costs": {
            pageEl: document.getElementById("page-reports-house-costs"),
            btnEl: document.getElementById("showReportsHouseCostsBtn"),
            eventName: "page:reports-house-costs"
        },
        "bank-matching": {
            pageEl: document.getElementById("page-bank-matching"),
            btnEl: document.getElementById("showBankMatchingBtn"),
            eventName: "page:bank-matching"
        },
        "value-sets": {
            pageEl: document.getElementById("page-value-sets"),
            btnEl: document.getElementById("showValueSetsBtn"),
            eventName: "page:value-sets"
        },
        "admin-users": {
            pageEl: document.getElementById("page-admin-users"),
            btnEl: document.getElementById("showAdminUsersBtn"),
            eventName: "page:admin-users"
        },
        "admin-functions": {
            pageEl: document.getElementById("page-admin-functions"),
            btnEl: document.getElementById("showAdminFunctionsBtn"),
            eventName: "page:admin-functions"
        },
        "admin-permissions": {
            pageEl: document.getElementById("page-admin-permissions"),
            btnEl: document.getElementById("showAdminPermissionsBtn"),
            eventName: "page:admin-permissions"
        }
    };

    const hasAccess = (key) => {
        const v = myPermissions?.[key];
        return !!v && String(v).toLowerCase() !== "none";
    };

    const requiredPagePermission = {
        "reports-house-costs": "reports_house_costs",
        "value-sets": "value_sets_read"
    };
    const requiredPermission = requiredPagePermission[page];

    if (requiredPermission && !hasAccess(requiredPermission)) {
        if (hasAccess("tx_read")) {
            page = "transactions";
        } else if (hasAccess("se_read")) {
            page = "shared";
        } else if (hasAccess("reports_house_costs")) {
            page = "reports-house-costs";
        } else if (hasAccess("admin_users")) {
            page = "admin-users";
        } else if (hasAccess("admin_functions")) {
            page = "admin-functions";
        } else if (hasAccess("admin_permissions")) {
            page = "admin-permissions";
        } else {
            page = "shared";
        }
    }

    Object.values(pages).forEach(({ pageEl, btnEl }) => {
        pageEl?.classList.add("hidden");
        btnEl?.classList.remove("active");
    });

    const target = pages[page];
    if (!target) return;

    target.pageEl?.classList.remove("hidden");
    target.btnEl?.classList.add("active");

    // Az oldalbetöltés hivatalos belépési pontja a page event dispatch.
    // Itt szándékosan nincs közvetlen load*() hívás.
    document.dispatchEvent(new CustomEvent(target.eventName));

    if (typeof applySidebarPermissions === "function") {
        applySidebarPermissions();
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
document.getElementById("showReportsMonthlyBtn")?.addEventListener("click", () => {
    showPage("reports-monthly");
});
document.getElementById("showReportsHouseCostsBtn")?.addEventListener("click", () => {
    showPage("reports-house-costs");
});
document.getElementById("showBankMatchingBtn")?.addEventListener("click", () => {
    showPage("bank-matching");
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
    const reportsMonthlyBtn = document.getElementById("showReportsMonthlyBtn");
    const reportsHouseCostsBtn = document.getElementById("showReportsHouseCostsBtn");
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
    [txBtn, seBtn, bankImportBtn, reportsMonthlyBtn, reportsHouseCostsBtn, adminUsersBtn, adminFunctionsBtn, adminPermissionsBtn,
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
    if (!hasAccess("tx_read") && reportsMonthlyBtn) reportsMonthlyBtn.style.display = "none";
    if (!hasAccess("reports_house_costs") && reportsHouseCostsBtn) reportsHouseCostsBtn.style.display = "none";
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
