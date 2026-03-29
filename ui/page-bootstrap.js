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
            if (window.transactionsPageBridge) {
                typeof window.transactionsPageBridge.resetPage === "function" &&
                    window.transactionsPageBridge.resetPage();
                typeof window.transactionsPageBridge.load === "function" &&
                    window.transactionsPageBridge.load();
                return;
            }

            txCurrentPage = 1;
            typeof loadTransactions === "function" && loadTransactions();
        });
        registerPageEvent("page:shared", () => {
            if (window.sharedExpensesPageBridge) {
                typeof window.sharedExpensesPageBridge.resetPage === "function" &&
                    window.sharedExpensesPageBridge.resetPage();
                typeof window.sharedExpensesPageBridge.load === "function" &&
                    window.sharedExpensesPageBridge.load();
                return;
            }

            typeof loadSharedExpenses === "function" && loadSharedExpenses();
        });
        registerPageEvent("page:bank-import", () => {
            if (window.bankImportPageBridge) {
                typeof window.bankImportPageBridge.resetPage === "function" &&
                    window.bankImportPageBridge.resetPage();
                typeof window.bankImportPageBridge.load === "function" &&
                    window.bankImportPageBridge.load();
                return;
            }

            typeof loadBankTransactions === "function" && loadBankTransactions();
        });
        registerPageEvent("page:value-sets", () => {
            if (window.valueSetsPageBridge) {
                typeof window.valueSetsPageBridge.resetPage === "function" &&
                    window.valueSetsPageBridge.resetPage();
                typeof window.valueSetsPageBridge.load === "function" &&
                    window.valueSetsPageBridge.load();
                return;
            }

            typeof loadValueSetsPage === "function" && loadValueSetsPage();
        });
        registerPageEvent("page:admin-users", () => {
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadUsers === "function" &&
                    window.adminPagesBridge.loadUsers();
                return;
            }

            typeof loadAdminUsers === "function" && loadAdminUsers();
        });

        registerPageEvent("page:admin-functions", () => {
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadFunctions === "function" &&
                    window.adminPagesBridge.loadFunctions();
                return;
            }

            typeof loadAdminFunctions === "function" && loadAdminFunctions();
        });

        registerPageEvent("page:admin-permissions", () => {
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadPermissions === "function" &&
                    window.adminPagesBridge.loadPermissions();
                return;
            }

            typeof loadAdminPermissions === "function" && loadAdminPermissions();
        });
    }

    window.initPageBootstrapping = initPageBootstrapping;
})();