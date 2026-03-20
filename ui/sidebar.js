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
