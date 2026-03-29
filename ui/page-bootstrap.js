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
            // Elsődleges útvonal:
            // sidebar -> page event -> transactionsPageBridge.resetPage() -> transactionsPageBridge.load()
            if (window.transactionsPageBridge) {
                typeof window.transactionsPageBridge.resetPage === "function" &&
                    window.transactionsPageBridge.resetPage();
                typeof window.transactionsPageBridge.load === "function" &&
                    window.transactionsPageBridge.load();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            txCurrentPage = 1;
            typeof loadTransactions === "function" && loadTransactions();
        });

        registerPageEvent("page:shared", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> sharedExpensesPageBridge.resetPage() -> sharedExpensesPageBridge.load()
            if (window.sharedExpensesPageBridge) {
                typeof window.sharedExpensesPageBridge.resetPage === "function" &&
                    window.sharedExpensesPageBridge.resetPage();
                typeof window.sharedExpensesPageBridge.load === "function" &&
                    window.sharedExpensesPageBridge.load();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadSharedExpenses === "function" && loadSharedExpenses();
        });

        registerPageEvent("page:bank-import", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> bankImportPageBridge.resetPage() -> bankImportPageBridge.load()
            if (window.bankImportPageBridge) {
                typeof window.bankImportPageBridge.resetPage === "function" &&
                    window.bankImportPageBridge.resetPage();
                typeof window.bankImportPageBridge.load === "function" &&
                    window.bankImportPageBridge.load();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadBankTransactions === "function" && loadBankTransactions();
        });

        registerPageEvent("page:value-sets", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> valueSetsPageBridge.resetPage() -> valueSetsPageBridge.load()
            if (window.valueSetsPageBridge) {
                typeof window.valueSetsPageBridge.resetPage === "function" &&
                    window.valueSetsPageBridge.resetPage();
                typeof window.valueSetsPageBridge.load === "function" &&
                    window.valueSetsPageBridge.load();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadValueSetsPage === "function" && loadValueSetsPage();
        });

        registerPageEvent("page:admin-users", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> adminPagesBridge.loadUsers()
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadUsers === "function" &&
                    window.adminPagesBridge.loadUsers();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadAdminUsers === "function" && loadAdminUsers();
        });

        registerPageEvent("page:admin-functions", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> adminPagesBridge.loadFunctions()
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadFunctions === "function" &&
                    window.adminPagesBridge.loadFunctions();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadAdminFunctions === "function" && loadAdminFunctions();
        });

        registerPageEvent("page:admin-permissions", () => {
            // Elsődleges útvonal:
            // sidebar -> page event -> adminPagesBridge.loadPermissions()
            if (window.adminPagesBridge) {
                typeof window.adminPagesBridge.loadPermissions === "function" &&
                    window.adminPagesBridge.loadPermissions();
                return;
            }

            // Legacy fallback részlegesen frissült állapotokra.
            // Nem elsődleges page-enter ág.
            typeof loadAdminPermissions === "function" && loadAdminPermissions();
        });
    }

    window.initPageBootstrapping = initPageBootstrapping;
})();