// ===== Lista betöltése =====
const loginPage = document.getElementById("page-login");
const sidebar = document.querySelector(".sidebar");
const content = document.querySelector(".content-wrapper");
let loginMode = "login"; // "login" | "setup"
const confirmBlock = document.getElementById("loginConfirmBlock");

const showLogin = (msg) => {
    if (loginPage) loginPage.style.display = "flex";
    if (sidebar) sidebar.style.display = "none";
    if (content) content.style.display = "none";

    const box = document.getElementById("loginError");
    if (box) {
        box.style.display = msg ? "block" : "none";
        box.textContent = msg || "";
    }
};

const showApp = () => {
    if (loginPage) loginPage.style.display = "none";
    if (sidebar) sidebar.style.display = "";
    if (content) content.style.display = "";
};
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try { await api.logout(); } catch (e) { }
    localStorage.removeItem("gda_auth_token");
    // Teljes UI reset (sidebar + body classok)
    localStorage.setItem("sidebarCollapsed", "0");
    document.body.classList.remove("sidebar-collapsed");
    document.querySelector(".sidebar")?.classList.remove("collapsed");
    document.querySelector(".content-wrapper")?.classList.remove("sidebar-collapsed");

    // hamburger láthatóság reset (ha CSS/JS vezérli)
    document.getElementById("hamburgerBtn")?.classList.remove("hidden");

    // login UI reset
    const confirmBlock = document.getElementById("loginConfirmBlock");
    if (confirmBlock) confirmBlock.style.display = "none";
    const pw2 = document.getElementById("loginPassword2");
    if (pw2) pw2.value = "";

    showLogin("");
});

const ensureAuth = async () => {
    const token = localStorage.getItem("gda_auth_token") || "";
    if (!token) return false;

    try {
        const resp = await api.whoami();
        return !!(resp && resp.success);
    } catch (err) {
        console.error("whoami ellenőrzés sikertelen:", err);
        return false;
    }
};
function getLandingPage() {
    const hasAccess = (key) => {
        const v = myPermissions?.[key];
        return !!v && String(v).toLowerCase() !== "none";
    };

    if (hasAccess("tx_read")) return "transactions";
    if (hasAccess("se_read")) return "shared";
    if (hasAccess("value_sets_read")) return "value-sets";

    // admin oldalak – első elérhető
    if (hasAccess("admin_users")) return "admin-users";
    if (hasAccess("admin_functions")) return "admin-functions";
    if (hasAccess("admin_permissions")) return "admin-permissions";

    // ha semmi sincs, maradjon a shared
    return "shared";
}


const loadMyPermissions = async () => {
    try {
        const resp = await api.getMyPermissions();
        myPermissions = (resp && resp.success && resp.permissions) ? resp.permissions : {};
    } catch (e) {
        myPermissions = {};
    }
};

// Login submit
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail")?.value || "";
    const password = document.getElementById("loginPassword")?.value || "";
    if (loginMode === "setup") {
        const p1 = document.getElementById("loginPassword")?.value || "";
        const p2 = document.getElementById("loginPassword2")?.value || "";
        if (!p1) {
            showLogin("Adj meg egy jelszót.");
            return;
        }
        if (p1 !== p2) {
            showLogin("A két jelszó nem egyezik.");
            return;
        }
    }

    let resp;
    let confirmBlock = document.getElementById("loginConfirmBlock");

    try {
        resp = await api.login(email, password);
    } catch (err) {
        console.error("Bejelentkezés sikertelen:", err);
        showLogin("Nem sikerült kapcsolódni a szerverhez. Próbáld újra.");
        return;
    }

    // Első belépés 1. kör: backend kéri a jelszó beállítását
    if (resp && resp.setup_required) {
        if (confirmBlock) confirmBlock.style.display = "block";
        showLogin(resp.message || "Első belépés: állíts be jelszót, majd erősítsd meg.");
        // setup módban a böngészőnek jelezzük: új jelszó beállítása
        const pw1 = document.getElementById("loginPassword");
        const pw2 = document.getElementById("loginPassword2");
        if (pw1) pw1.setAttribute("autocomplete", "new-password");
        if (pw2) {
            pw2.setAttribute("autocomplete", "new-password");
            pw2.required = true;
        }
        return;
    }

    // Ha látszik a confirm mező, akkor egyezőséget kérünk
    if (confirmBlock && confirmBlock.style.display !== "none") {
        const p1 = document.getElementById("loginPassword")?.value || "";
        const p2 = document.getElementById("loginPassword2")?.value || "";
        if (!p1) { showLogin("Adj meg egy jelszót."); return; }
        if (p1 !== p2) { showLogin("A két jelszó nem egyezik."); return; }
    }

    if (!resp || !resp.success || !resp.token) {
        showLogin(resp?.error || resp?.message || "Sikertelen bejelentkezés.");
        return;
    }

    localStorage.setItem("gda_auth_token", resp.token);

    // Ha látszik a confirm mező, akkor egyezőséget kérünk
    if (confirmBlock && confirmBlock.style.display !== "none") {
        const p1 = document.getElementById("loginPassword")?.value || "";
        const p2 = document.getElementById("loginPassword2")?.value || "";
        if (!p1) { showLogin("Adj meg egy jelszót."); return; }
        if (p1 !== p2) { showLogin("A két jelszó nem egyezik."); return; }
    }

    if (!resp || !resp.success || !resp.token) {
        showLogin(resp?.error || "Sikertelen bejelentkezés.");
        return;
    }

    localStorage.setItem("gda_auth_token", resp.token);
    // login módban: mentett jelszó használata
    const pw1 = document.getElementById("loginPassword");
    const pw2 = document.getElementById("loginPassword2");
    if (pw1) pw1.setAttribute("autocomplete", "current-password");
    if (pw2) {
        pw2.required = false;
        pw2.value = "";
    }
    // Password manager (SPA): explicit credential store (ha támogatott)
    try {
        const form = document.getElementById("loginForm");
        if (form && "credentials" in navigator && window.PasswordCredential) {
            await navigator.credentials.store(new PasswordCredential(form));
        }
    } catch (e2) {
        // nem támogatott / nem secure context -> ignoráljuk
    }

        showApp();

        // Login után: datalist értékek betöltése már érvényes tokennel.
        if (typeof loadDropdownValues === "function") {
            await loadDropdownValues();
        }

        // Login után: sidebar kinyitása (ha korábban el volt csukva)
        localStorage.setItem("sidebarCollapsed", "0");
        document.body.classList.remove("sidebar-collapsed");
        document.querySelector(".sidebar")?.classList.remove("collapsed");
        document.querySelector(".content-wrapper")?.classList.remove("sidebar-collapsed");

        // eredeti init
        await loadMyPermissions();

        showPage(getLandingPage());
});

// indulás
(async () => {
    const ok = await ensureAuth();

    // döntés után lehet “felébreszteni” a UI-t
    document.body.classList.remove("boot");
    if (!ok) {
        showLogin("");
        return;
    }
    showApp();
    await loadMyPermissions();

    showPage(getLandingPage());
})();

