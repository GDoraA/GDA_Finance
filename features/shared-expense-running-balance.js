(function () {
    function toAmount(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const normalized = String(value ?? "")
            .trim()
            .replace(/\s+/g, "")
            .replace(/ft/ig, "")
            .replace(",", ".");
        const amount = Number(normalized);
        return Number.isFinite(amount) ? amount : 0;
    }

    function isSettlement(row) {
        return String(row?.title || "").trim().toLowerCase().includes("törleszt");
    }

    function getRecordEffect(row) {
        const paidBy = String(row?.paid_by || "").trim().toLowerCase();

        if (isSettlement(row)) {
            const amount = Math.abs(toAmount(row?.amount));
            return {
                signedChange: amount,
                amount,
                kind: "settlement",
                description: `Zsolti tartozása −${amount}`
            };
        }

        if (paidBy.includes("dóri") || paidBy === "dori") {
            const amount = Math.abs(toAmount(row?.Zsolti_balance));
            return {
                signedChange: -amount,
                amount,
                kind: "zsolti-debt",
                description: `Zsolti tartozása +${amount}`
            };
        }

        if (paidBy.includes("zsolti")) {
            const amount = Math.abs(toAmount(row?.Dori_balance));
            return {
                signedChange: amount,
                amount,
                kind: "dori-debt",
                description: `Dóri tartozása +${amount}`
            };
        }

        return {
            signedChange: 0,
            amount: 0,
            kind: "none",
            description: "Nincs egyenleghatás"
        };
    }

    function toTimestamp(value) {
        if (!value) return 0;
        const direct = new Date(value).getTime();
        if (!Number.isNaN(direct)) return direct;
        const normalized = String(value).trim().replace(/\.$/, "").replace(/\./g, "-");
        const fallback = new Date(normalized).getTime();
        return Number.isNaN(fallback) ? 0 : fallback;
    }

    function calculate(rows) {
        const chronologicalRows = (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
            const dateDifference = toTimestamp(a?.date) - toTimestamp(b?.date);
            if (dateDifference !== 0) return dateDifference;
            const createdDifference = toTimestamp(a?.created_at) - toTimestamp(b?.created_at);
            if (createdDifference !== 0) return createdDifference;
            return String(a?.id || "").localeCompare(String(b?.id || ""), "hu");
        });

        const byRow = new Map();
        const byId = new Map();
        let net = 0;

        chronologicalRows.forEach((row, index) => {
            const effect = getRecordEffect(row);
            net += effect.signedChange;
            if (Math.abs(net) < 0.000001) net = 0;
            const state = {
                index: index + 1,
                effect,
                net,
                doriDebt: Math.max(net, 0),
                zsoltiDebt: Math.max(-net, 0)
            };
            byRow.set(row, state);
            if (row?.id !== undefined && row?.id !== null) {
                byId.set(String(row.id), state);
            }
        });

        return { byRow, byId, finalNet: net, chronologicalRows };
    }

    window.sharedExpenseRunningBalance = { calculate, getRecordEffect, isSettlement };
})();
