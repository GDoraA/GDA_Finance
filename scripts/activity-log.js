(function () {
    const STORAGE_KEY = "gda_global_activity_log_v1";
    const MAX_LINES = 2000;
    const mutationActions = new Set([
        "addTransaction", "addTransactions", "addBankTransactions",
        "refreshHouseCosts", "updateHouseCostSettled",
        "setBankTransactionMatchStatus", "updateTransaction", "bulkMatchTransactions",
        "deleteTransaction", "deleteSharedExpense", "addValueToSet",
        "refreshSharedExpenses", "updateSharedExpense", "addSharedExpense",
        "updateSharedExpenseRow", "setPermission", "addUser"
    ]);
    const actionLabels = {
        addTransaction: "Tranzakció létrehozása",
        addTransactions: "Tranzakciók csoportos létrehozása",
        addBankTransactions: "Banki tranzakciók importálása",
        refreshHouseCosts: "Házköltségek frissítése",
        updateHouseCostSettled: "Házköltség rendezettségének módosítása",
        setBankTransactionMatchStatus: "Banki párosítás státuszának módosítása",
        updateTransaction: "Tranzakció módosítása",
        bulkMatchTransactions: "Tranzakciók csoportos párosítása",
        deleteTransaction: "Tranzakció törlése",
        deleteSharedExpense: "Megosztott költség törlése",
        addValueToSet: "Értékkészlet bővítése",
        refreshSharedExpenses: "Megosztott költségek frissítése",
        updateSharedExpense: "Megosztott költség mezőjének módosítása",
        addSharedExpense: "Megosztott költség létrehozása",
        updateSharedExpenseRow: "Megosztott költség módosítása",
        setPermission: "Jogosultság módosítása",
        addUser: "Felhasználó létrehozása"
    };
    const fieldLabels = {
        month: "Hónap",
        date: "Dátum",
        amount: "Összeg",
        title: "Megnevezés",
        category: "Kategória",
        payment_type: "Fizetési mód",
        transaction_type: "Típus",
        is_shared: "Megosztott",
        statement_item: "Kapcsolt banki tétel",
        paid_by: "Fizette"
    };

    let lines = loadLines();
    let unread = 0;

    function loadLines() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(stored) ? stored.slice(-MAX_LINES) : [];
        } catch (_) { return []; }
    }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.slice(-MAX_LINES))); } catch (_) { }
    }

    function append(level, message) {
        const timestamp = new Date().toLocaleString("hu-HU");
        String(message || "").split(/\r?\n/).forEach(line => {
            lines.push(`[${timestamp}] [${level}] ${line}`);
        });
        lines = lines.slice(-MAX_LINES);
        if (document.getElementById("globalActivityLogPanel")?.classList.contains("hidden")) unread++;
        persist();
        render();
    }

    function safeParams(params) {
        const safe = {};
        Object.entries(params || {}).forEach(([key, value]) => {
            if (/password|token/i.test(key)) {
                safe[key] = "[REJTETT]";
            } else if (key === "items") {
                try {
                    const items = typeof value === "string" ? JSON.parse(value) : value;
                    safe.items_count = Array.isArray(items) ? items.length : 0;
                    safe.item_ids = Array.isArray(items)
                        ? items.map(item => item?.id || item?.transaction_id || item?.title || "?")
                        : [];
                } catch (_) { safe.items = "[nem feldolgozható lista]"; }
            } else {
                safe[key] = value;
            }
        });
        return JSON.stringify(safe);
    }

    function normalizeChangeValue(field, value) {
        if (field === "is_shared") {
            return (value === true || value === "true" || value === "1" || value === "x") ? "x" : "";
        }

        const normalized = String(value ?? "").trim();
        if (field === "date" && normalized.includes("T")) return normalized.split("T")[0];
        if (field === "amount" && normalized !== "" && Number.isFinite(Number(normalized))) {
            return String(Number(normalized));
        }
        return normalized;
    }

    function formatChangeValue(value) {
        const text = String(value ?? "").replace(/\r?\n/g, " ");
        return text === "" ? "∅" : `„${text}”`;
    }

    function collectChanges(details) {
        const before = details?.before;
        const after = details?.after;
        if (!before || !after) return [];

        return Object.keys(after)
            .filter(field => field !== "id")
            .map(field => {
                const oldValue = normalizeChangeValue(field, before[field]);
                const newValue = normalizeChangeValue(field, after[field]);
                if (oldValue === newValue) return null;
                return {
                    field,
                    label: fieldLabels[field] || field,
                    oldValue,
                    newValue
                };
            })
            .filter(Boolean);
    }

    function render() {
        const output = document.getElementById("globalActivityLogOutput");
        if (output) {
            output.textContent = lines.length ? lines.join("\n") : "Még nem történt változás.";
            output.scrollTop = output.scrollHeight;
        }
        const badge = document.getElementById("globalActivityLogBadge");
        if (badge) {
            badge.textContent = String(unread);
            badge.classList.toggle("hidden", unread === 0);
        }
    }

    function start(action, params, details = null) {
        const mutation = mutationActions.has(action);
        const context = {
            action,
            label: actionLabels[action] || action,
            startedAt: Date.now(),
            mutation,
            recordId: String(params?.id ?? "").trim(),
            changes: collectChanges(details)
        };
        if (mutation) append("INDÍTÁS", `${context.label}; paraméterek: ${safeParams(params)}`);
        return context;
    }

    function finish(context, response) {
        if (!context) return;
        if (!context.mutation) {
            if (response?.success === false) {
                append("HIBA", `${context.label} sikertelen: ${response.error || response.message || "ismeretlen szerverhiba"}`);
            }
            return;
        }
        (Array.isArray(response?.log) ? response.log : []).forEach(line => append("RÉSZLET", line));
        const duration = Date.now() - context.startedAt;
        if (response?.success === false) {
            append("HIBA", `${context.label} sikertelen ${duration} ms után: ${response.error || response.message || "ismeretlen szerverhiba"}`);
            return;
        }
        context.changes.forEach(change => {
            const record = context.recordId ? ` [${context.recordId}]` : "";
            append(
                "VÁLTOZÁS",
                `${context.label}${record}; ${change.label}: ` +
                `${formatChangeValue(change.oldValue)} → ${formatChangeValue(change.newValue)}`
            );
        });
        const summary = {};
        ["id", "created", "updated", "unchanged", "deleted", "duplicates", "count"].forEach(key => {
            if (response?.[key] !== undefined) summary[key] = response[key];
        });
        append("SIKER", `${context.label} befejeződött ${duration} ms alatt; eredmény: ${JSON.stringify(summary)}`);
    }

    function fail(context, error) {
        if (!context) return;
        append("HIBA", `${context.label} megszakadt ${Date.now() - context.startedAt} ms után; ` +
            `${error?.name || "Error"}: ${error?.message || String(error)}` +
            `${error?.stack ? ` | ${error.stack}` : ""}; hálózat: ${navigator.onLine ? "online" : "offline"}`);
    }

    function openPanel() {
        document.getElementById("globalActivityLogPanel")?.classList.remove("hidden");
        document.getElementById("globalActivityLogToggle")?.setAttribute("aria-expanded", "true");
        unread = 0;
        render();
    }

    function closePanel() {
        document.getElementById("globalActivityLogPanel")?.classList.add("hidden");
        document.getElementById("globalActivityLogToggle")?.setAttribute("aria-expanded", "false");
    }

    document.getElementById("globalActivityLogToggle")?.addEventListener("click", openPanel);
    document.getElementById("globalActivityLogClose")?.addEventListener("click", closePanel);
    document.getElementById("globalActivityLogClear")?.addEventListener("click", () => {
        lines = [];
        unread = 0;
        persist();
        render();
    });
    document.getElementById("globalActivityLogCopy")?.addEventListener("click", async () => {
        try {
            if (!lines.length) throw new Error("A napló üres.");
            await navigator.clipboard.writeText(lines.join("\n"));
            append("INFO", "A változásnapló a vágólapra másolva.");
        } catch (error) {
            append("HIBA", `A napló másolása sikertelen: ${error?.message || String(error)}`);
        }
    });

    window.activityLog = {
        append,
        start,
        finish,
        fail,
        open: openPanel,
        isMutation: action => mutationActions.has(action)
    };
    render();
})();
