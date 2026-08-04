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

    if (!page || typeof canOpenPage !== "function" || !canOpenPage(page)) {
        page = typeof getFirstAccessiblePage === "function"
            ? getFirstAccessiblePage()
            : null;
    }

    Object.values(pages).forEach(({ pageEl, btnEl }) => {
        pageEl?.classList.add("hidden");
        btnEl?.classList.remove("active");
    });

    const target = page ? pages[page] : null;
    if (!target) {
        if (typeof applySidebarPermissions === "function") {
            applySidebarPermissions();
        }
        return;
    }

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
    const bankMatchingBtn = document.getElementById("showBankMatchingBtn");
    const valueSetsBtn = document.getElementById("showValueSetsBtn");
    const adminUsersBtn = document.getElementById("showAdminUsersBtn");
    const adminFunctionsBtn = document.getElementById("showAdminFunctionsBtn");
    const adminPermissionsBtn = document.getElementById("showAdminPermissionsBtn");
    // Oldalon belüli akciógombok
    const txCreateBtn = document.getElementById("openModalBtn");            // Új tranzakció
    const txBulkMatchBtn = document.getElementById("bulkMatchBtn");
    const txImportBtn = document.getElementById("importCsvBtn");            // Import
    const bankImportPickBtn = document.getElementById("bankImportPickFileBtn");
    const bankImportUploadBtn = document.getElementById("bankImportUploadBtn");
    const seCreateBtn = document.getElementById("addSharedExpenseBtn");     // + Új megosztott tétel
    const seSettleBtn = document.getElementById("addSettlementInlineBtn");  // + Törlesztés
    const seRefreshBtn = document.getElementById("refreshSharedExpensesBtn");
    // Kényszerített megjelenítés: ne üres stringgel “reseteljünk”, mert az nem mindig hozza vissza
    const setBtnVisible = (btn, visible) => {
        if (!btn) return;
        btn.style.display = visible ? "inline-flex" : "none";
    };
    // RESET: ha korábban el volt rejtve (display:none), most legyen visszaállítva,
    // különben “beragad” és hiába kap jogot, nem jelenik meg.
    [txBtn, seBtn, bankImportBtn, reportsMonthlyBtn, reportsHouseCostsBtn, bankMatchingBtn, valueSetsBtn,
        adminUsersBtn, adminFunctionsBtn, adminPermissionsBtn, txCreateBtn, txBulkMatchBtn, txImportBtn,
        bankImportPickBtn, bankImportUploadBtn, seCreateBtn, seSettleBtn, seRefreshBtn].forEach((b) => {

            if (b) b.style.display = "";
        });

    const pageButtons = {
        transactions: txBtn,
        shared: seBtn,
        "bank-import": bankImportBtn,
        "reports-monthly": reportsMonthlyBtn,
        "reports-house-costs": reportsHouseCostsBtn,
        "bank-matching": bankMatchingBtn,
        "value-sets": valueSetsBtn,
        "admin-users": adminUsersBtn,
        "admin-functions": adminFunctionsBtn,
        "admin-permissions": adminPermissionsBtn
    };

    Object.entries(pageButtons).forEach(([page, btn]) => {
        if (btn) btn.style.display = canOpenPage(page) ? "" : "none";
    });

    setBtnVisible(txCreateBtn, hasPermission("tx_create", "write"));
    setBtnVisible(txBulkMatchBtn, hasPermission("tx_update", "write"));
    setBtnVisible(txImportBtn, hasPermission("tx_import", "write"));
    setBtnVisible(bankImportPickBtn, hasPermission("tx_import", "write"));
    setBtnVisible(bankImportUploadBtn, hasPermission("tx_import", "write"));
    setBtnVisible(seCreateBtn, hasPermission("se_create", "write"));
    setBtnVisible(seSettleBtn, hasPermission("se_settlement_create", "write"));
    setBtnVisible(seRefreshBtn, hasPermission("se_update", "write"));
}
