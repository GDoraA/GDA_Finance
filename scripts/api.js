// ----------- API KONFIG -------------
const API_URL = "https://script.google.com/macros/s/AKfycbyHMJPthnu3dj00oMMjaOc62_V8RO9o4U_Q9C_YxoVugR_BPBiBJc1S9MMkgn4HUPU/exec";
let activeApiRequestCount = 0;

function setApiLoadingState(isLoading) {
    activeApiRequestCount = Math.max(0, activeApiRequestCount + (isLoading ? 1 : -1));
    document.documentElement.classList.toggle("api-loading", activeApiRequestCount > 0);
}


// ----------- JSONP HÍVÓ FUNKCIÓ -------------
function jsonp(action, params = {}, activityDetails = null) {
    const activityContext = window.activityLog?.start(action, params, activityDetails) || null;
    setApiLoadingState(true);
    return new Promise((resolve, reject) => {
        const callbackName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        const token = localStorage.getItem("gda_auth_token") || "";
        const urlParams = new URLSearchParams({ action, callback: callbackName, token, _: Date.now() });

        Object.entries(params).forEach(([k, v]) => urlParams.set(k, v));

        const script = document.createElement("script");
        script.src = `${API_URL}?${urlParams.toString()}`;

        let settled = false;
        let loadingStateReleased = false;

        const cleanup = ({ keepNoopCallback = false } = {}) => {
            if (timeoutId) clearTimeout(timeoutId);
            try { script.remove(); } catch (_) { }

            if (!loadingStateReleased) {
                loadingStateReleased = true;
                setApiLoadingState(false);
            }

            if (keepNoopCallback) {
                window[callbackName] = function () { };
            } else {
                try { delete window[callbackName]; } catch (_) {
                    window[callbackName] = undefined;
                }
            }
        };

        window[callbackName] = function (response) {
            if (settled) return;
            settled = true;
            cleanup();
            window.activityLog?.finish(activityContext, response);
            resolve(response);
        };

        script.onerror = () => {
            if (settled) return;
            settled = true;
            cleanup();
            const error = new Error("JSONP hiba (script betöltés sikertelen)");
            window.activityLog?.fail(activityContext, error);
            reject(error);
        };

        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup({ keepNoopCallback: true });
            const error = new Error("JSONP timeout: a szerver nem válaszolt időben.");
            window.activityLog?.fail(activityContext, error);
            reject(error);

            setTimeout(() => {
                try { delete window[callbackName]; } catch (_) {
                    window[callbackName] = undefined;
                }
            }, 60000);
        }, 30000);

        document.body.appendChild(script);
    });
}
// ----------- API METÓDUSOK -------------
const api = {
    login(email, password) {
        return jsonp("login", { email, password });
    },
    whoami() {
        return jsonp("whoami");
    },
    getMyPermissions() {
        return jsonp("getMyPermissions");
    },
    logout() {
        const token = localStorage.getItem("gda_auth_token") || "";
        return jsonp("logout", { token });
    },
    addTransaction(data) {
        return jsonp("addTransaction", data);
    },
    addTransactions(items) {
        return jsonp("addTransactions", { items: JSON.stringify(items || []) });
    },
    addBankTransactions(items) {
        return jsonp("addBankTransactions", { items: JSON.stringify(items || []) });
    },
    getTransactions() {
        return jsonp("getTransactions");
    },
    getHouseCosts() {
        return jsonp("getHouseCosts");
    },
    refreshHouseCosts() {
        return jsonp("refreshHouseCosts");
    },
    updateHouseCostSettled(id, settled) {
        return jsonp("updateHouseCostSettled", { id, settled: settled ? "x" : "" });
    },
    getBankTransactions() {
        return jsonp("getBankTransactions");
    },
    setBankTransactionMatchStatus(id, status) {
        return jsonp("setBankTransactionMatchStatus", { id, status });
    },
    updateTransaction(data, previousData = null) {
        return jsonp("updateTransaction", data, {
            before: previousData,
            after: data
        });
    },
    bulkMatchTransactions(items) {
        return jsonp("bulkMatchTransactions", { items: JSON.stringify(items || []) });
    },
    deleteTransaction(id) {
        return jsonp("deleteTransaction", { id });
    },
    deleteSharedExpense(id) {
        return jsonp("deleteSharedExpense", { id });
    },
    getValueSets() {
        return jsonp("getValueSets");
    },
    getValueSetsDetailed() {
        return jsonp("getValueSetsDetailed");
    },
    addValueToSet(setName, value) {
        return jsonp("addValueToSet", { set: setName, value });
    },
    getSharedExpenses() {
        return jsonp("getSharedExpenses");
    },
    refreshSharedExpenses() {
        return jsonp("refreshSharedExpenses");
    },
    // --- ÚJ: Shared Expense mező módosítása ---
    updateSharedExpense(id, field, value) {
        return jsonp("updateSharedExpense", { id, field, value });
    },
    addSharedExpense(data) {
        return jsonp("addSharedExpense", data);
    },
    updateSharedExpenseRow(data) {
        return jsonp("updateSharedExpenseRow", data);
    },
    getUsers() {
        return jsonp("getUsers");
    },
    getFunctions() {
        return jsonp("getFunctions");
    },
    getPermissions() {
        return jsonp("getPermissions");
    },
    setPermission(email, function_key, access) {
        return jsonp("setPermission", { email, function_key, access });
    },
    addUser(name, email) {
        return jsonp("addUser", { name, email });
    },
};
