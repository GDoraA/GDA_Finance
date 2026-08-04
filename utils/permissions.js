(function initializePermissions(global) {
    const ACCESS_RANK = Object.freeze({
        none: 0,
        read: 1,
        write: 2
    });

    const PAGE_PERMISSION_RULES = Object.freeze({
        transactions: Object.freeze({ key: "tx_read", level: "read" }),
        shared: Object.freeze({ key: "se_read", level: "read" }),
        "bank-import": Object.freeze({ key: "tx_import", level: "read" }),
        "reports-monthly": Object.freeze({ key: "tx_read", level: "read" }),
        "reports-house-costs": Object.freeze({ key: "reports_house_costs", level: "read" }),
        "bank-matching": Object.freeze({ key: "tx_import", level: "read" }),
        "value-sets": Object.freeze({ key: "value_sets_read", level: "read" }),
        "admin-users": Object.freeze({ key: "admin_users", level: "read" }),
        "admin-functions": Object.freeze({ key: "admin_functions", level: "read" }),
        "admin-permissions": Object.freeze({ key: "admin_permissions", level: "read" })
    });

    const LANDING_PAGE_ORDER = Object.freeze([
        "transactions",
        "shared",
        "reports-house-costs",
        "bank-import",
        "reports-monthly",
        "bank-matching",
        "value-sets",
        "admin-users",
        "admin-functions",
        "admin-permissions"
    ]);

    global.myPermissions = global.myPermissions || {};
    global.myIsAdmin = global.myIsAdmin === true;

    global.normalizeAccessLevel = function normalizeAccessLevel(value) {
        const normalized = String(value || "").trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(ACCESS_RANK, normalized)
            ? normalized
            : "none";
    };

    global.hasPermission = function hasPermission(key, requiredLevel = "read") {
        if (global.myIsAdmin === true) return true;

        const actual = global.normalizeAccessLevel(global.myPermissions?.[key]);
        const required = global.normalizeAccessLevel(requiredLevel);
        return ACCESS_RANK[actual] >= ACCESS_RANK[required];
    };

    global.getPagePermissionRule = function getPagePermissionRule(page) {
        return PAGE_PERMISSION_RULES[page] || null;
    };

    global.canOpenPage = function canOpenPage(page) {
        const rule = global.getPagePermissionRule(page);
        return !!rule && global.hasPermission(rule.key, rule.level);
    };

    global.getFirstAccessiblePage = function getFirstAccessiblePage() {
        return LANDING_PAGE_ORDER.find(page => global.canOpenPage(page)) || null;
    };

    global.PERMISSION_PAGE_RULES = PAGE_PERMISSION_RULES;
})(window);
