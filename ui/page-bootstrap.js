(function () {
    let pageBootstrappingInitialized = false;

    function registerPageEvent(eventName, handler) {
        document.addEventListener(eventName, () => {
            if (typeof handler === "function") {
                handler();
            }
        });
    }

    function initPageBootstrapping() {
        if (pageBootstrappingInitialized) return;
        pageBootstrappingInitialized = true;
        registerPageEvent("page:transactions", () => {
            txCurrentPage = 1;
            typeof loadTransactions === "function" && loadTransactions();
        });
        registerPageEvent("page:shared", () => {
            typeof loadSharedExpenses === "function" && loadSharedExpenses();
        });

        registerPageEvent("page:bank-import", () => {
            typeof loadBankTransactions === "function" && loadBankTransactions();
        });

        registerPageEvent("page:value-sets", () => {
            typeof loadValueSetsPage === "function" && loadValueSetsPage();
        });

        registerPageEvent("page:admin-users", () => {
            typeof loadAdminUsers === "function" && loadAdminUsers();
        });

        registerPageEvent("page:admin-functions", () => {
            typeof loadAdminFunctions === "function" && loadAdminFunctions();
        });

        registerPageEvent("page:admin-permissions", () => {
            typeof loadAdminPermissions === "function" && loadAdminPermissions();
        });
    }

    window.initPageBootstrapping = initPageBootstrapping;
})();