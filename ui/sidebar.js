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
    const ownAccountsPage = document.getElementById("page-own-accounts");
    const adminPage = document.getElementById("page-admin-users");
    const adminFunctionsPage = document.getElementById("page-admin-functions");
    const adminPermissionsPage = document.getElementById("page-admin-permissions");
    const txBtn = document.getElementById("showTransactionsBtn");
    const sharedBtn = document.getElementById("showSharedExpensesBtn");
    const bankImportBtn = document.getElementById("showBankImportBtn");
    const valueSetsBtn = document.getElementById("showValueSetsBtn");
    const ownAccountsBtn = document.getElementById("showOwnAccountsBtn");
    const adminBtn = document.getElementById("showAdminUsersBtn");
    const adminFunctionsBtn = document.getElementById("showAdminFunctionsBtn");
    const adminPermissionsBtn = document.getElementById("showAdminPermissionsBtn");
    // mindent elrejt + active reset (minden ismert oldalra/gombra)
    [txPage, sharedPage, bankImportPage, valueSetsPage, ownAccountsPage, adminPage, adminFunctionsPage, adminPermissionsPage]
        .forEach(p => p && p.classList.add("hidden"));
    [txBtn, sharedBtn, bankImportBtn, valueSetsBtn, ownAccountsBtn, adminBtn, adminFunctionsBtn, adminPermissionsBtn]
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
        typeof loadValueSetsPage === "function" && document.dispatchEvent(new CustomEvent("page:value-sets"));
        typeof applySidebarPermissions === "function" && applySidebarPermissions();
        return;
    }
    if (page === "own-accounts") {
        ownAccountsPage?.classList.remove("hidden");
        ownAccountsBtn?.classList.add("active");
        document.dispatchEvent(new CustomEvent("page:own-accounts"));
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
document.getElementById("showOwnAccountsBtn")?.addEventListener("click", () => {
    showPage("own-accounts");
});