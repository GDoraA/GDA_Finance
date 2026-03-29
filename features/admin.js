window.adminPagesBridge = window.adminPagesBridge || {
    loadUsers() {
        return loadAdminUsers();
    },
    loadFunctions() {
        return loadAdminFunctions();
    },
    loadPermissions() {
        return loadAdminPermissions();
    }
};
function renderAdminLoadError(tbody, colspan, respOrError, fallbackMessage) {
    const message =
        respOrError?.error ||
        respOrError?.message ||
        fallbackMessage ||
        "Hiba a betöltés során.";

    if (respOrError instanceof Error) {
        console.error("Admin load error:", respOrError);
    } else if (respOrError) {
        console.warn("Admin unsuccessful response:", respOrError);
    }

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
    }
}
async function loadAdminUsers() {
    const tbody = document.getElementById("adminUsersBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getUsers();
    } catch (err) {
        renderAdminLoadError(
            tbody,
            4,
            err,
            "Hiba a felhasználók betöltésekor."
        );
        return;
    }

    if (!resp || !resp.success) {
        renderAdminLoadError(
            tbody,
            4,
            resp,
            "Hiba a felhasználók betöltésekor."
        );
        return;
    }

    const users = resp.users || [];
    for (const u of users) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(u.name || "")}</td>
            <td>${escapeHtml(u.email || "")}</td>
            <td>${escapeHtml(u.app_access || "")}</td>
            <td>${escapeHtml(u.is_admin || "")}</td>
        `;
        tbody.appendChild(tr);
    }
}
async function loadAdminFunctions() {
    const tbody = document.getElementById("adminFunctionsBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getFunctions();
    } catch (err) {
        renderAdminLoadError(
            tbody,
            3,
            err,
            "Hiba a funkciók betöltésekor."
        );
        return;
    }

    if (!resp || !resp.success) {
        renderAdminLoadError(
            tbody,
            3,
            resp,
            "Hiba a funkciók betöltésekor."
        );
        return;
    }

    const functions = resp.functions || [];
    for (const fn of functions) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(fn.function_key || "")}</td>
            <td>${escapeHtml(fn.name || "")}</td>
            <td>${escapeHtml(fn.description || "")}</td>
        `;
        tbody.appendChild(tr);
    }
}
async function loadAdminPermissions() {
    const tbody = document.getElementById("adminPermissionsBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getPermissions();
    } catch (err) {
        renderAdminLoadError(
            tbody,
            3,
            err,
            "Hiba a jogosultságok betöltésekor."
        );
        return;
    }

    if (!resp || !resp.success) {
        renderAdminLoadError(
            tbody,
            3,
            resp,
            "Hiba a jogosultságok betöltésekor."
        );
        return;
    }

    const rows = resp.permissions || [];
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság beállítás</td></tr>`;
        return;
    }

    for (const r of rows) {
        const tr = document.createElement("tr");
        const current = String(r.access || "").toLowerCase();
        const val = (["none", "read", "write"].includes(current) ? current : "none");

        tr.innerHTML = `
            <td>${escapeHtml(r.email || "")}</td>
            <td>${escapeHtml(r.function_key || "")}</td>
            <td>
              <select class="perm-access" data-email="${escapeHtml(r.email || "")}" data-function="${escapeHtml(r.function_key || "")}">
                <option value="none" ${val === "none" ? "selected" : ""}>none</option>
                <option value="read" ${val === "read" ? "selected" : ""}>read</option>
                <option value="write" ${val === "write" ? "selected" : ""}>write</option>
              </select>
            </td>
        `;

        tbody.querySelectorAll("select.perm-access").forEach(sel => {
            sel.addEventListener("change", async () => {
                const email = sel.getAttribute("data-email");
                const function_key = sel.getAttribute("data-function");
                const access = sel.value;

                try {
                    const resp = await api.setPermission(email, function_key, access);
                    if (!resp || !resp.success) {
                        alert("Nem sikerült menteni a jogosultságot.");
                    }
                } catch (e) {
                    alert("Hiba a jogosultság mentésekor.");
                }
            });
        });

        tbody.appendChild(tr);
    }
}
document.getElementById("adminUserForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("adminUserName")?.value?.trim() || "";
    const email = document.getElementById("adminUserEmail")?.value?.trim() || "";

    const msg = document.getElementById("adminUserMsg");
    if (msg) {
        msg.style.display = "none";
        msg.className = "msg";
        msg.textContent = "";
    }

    let resp;
    try {
        resp = await api.addUser(name, email);
    } catch (err) {
        console.error("Felhasználó hozzáadása sikertelen:", err);
        if (msg) {
            msg.style.display = "block";
            msg.className = "msg error";
            msg.textContent = "Nem sikerült kapcsolódni a szerverhez. Próbáld újra.";
        }
        return;
    }

    if (!resp || !resp.success) {
        if (msg) {
            msg.style.display = "block";
            msg.className = "msg error";
            msg.textContent = resp?.error || resp?.message || "Hiba történt.";
        }
        return;
    }

    document.getElementById("adminUserName").value = "";
    document.getElementById("adminUserEmail").value = "";

    if (msg) {
        msg.style.display = "block";
        msg.className = "msg success";
        msg.textContent = "Felhasználó hozzáadva.";
    }

    await loadAdminUsers();
});
window.loadAdminUsers = loadAdminUsers;
window.loadAdminFunctions = loadAdminFunctions;
window.loadAdminPermissions = loadAdminPermissions;