async function loadAdminUsers() {
    const tbody = document.getElementById("adminUsersBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let resp;
    try {
        resp = await api.getUsers();
    } catch (err) {
        console.error("Felhasználók betöltése sikertelen:", err);
        tbody.innerHTML = `<tr><td colspan="4">Hiba a felhasználók betöltésekor.</td></tr>`;
        return;
    }

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="4">Nincs jogosultság vagy hiba: ${escapeHtml(resp?.error || resp?.message || "ismeretlen")}</td></tr>`;
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
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3">Hiba a funkciók betöltésekor</td></tr>`;
        return;
    }

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság vagy hiba: ${resp?.error || "ismeretlen"}</td></tr>`;
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
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3">Hiba a jogosultságok betöltésekor</td></tr>`;
        return;
    }

    if (!resp || !resp.success) {
        tbody.innerHTML = `<tr><td colspan="3">Nincs jogosultság vagy hiba: ${resp?.error || "ismeretlen"}</td></tr>`;
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