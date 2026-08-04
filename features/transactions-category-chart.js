(function () {
    const chartColors = [
        "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
        "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
        "#0f766e", "#be123c", "#9333ea", "#0284c7", "#ca8a04"
    ];

    function parseCategoryChartAmount(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        if (typeof parseNumberHu === "function") {
            const parsed = parseNumberHu(value);
            return parsed === null ? 0 : Number(parsed) || 0;
        }

        let normalized = String(value ?? "")
            .trim()
            .replace(/ft/ig, "")
            .replace(/\s+/g, "");
        if (normalized.includes(",") && normalized.includes(".")) {
            normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else {
            normalized = normalized.replace(",", ".");
        }
        const amount = Number(normalized);
        return Number.isFinite(amount) ? amount : 0;
    }

    function aggregateTransactionsByCategory(rows) {
        const categories = new Map();
        (Array.isArray(rows) ? rows : []).forEach(row => {
            const category = String(row?.category || "").trim() || "Nincs kategória";
            const amount = Math.abs(parseCategoryChartAmount(row?.amount));
            if (amount <= 0) return;
            const current = categories.get(category) || { category, amount: 0, count: 0 };
            current.amount += amount;
            current.count++;
            categories.set(category, current);
        });

        const items = Array.from(categories.values()).sort((a, b) => {
            if (b.amount !== a.amount) return b.amount - a.amount;
            return a.category.localeCompare(b.category, "hu");
        });
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        return {
            items: items.map((item, index) => ({
                ...item,
                percentage: total > 0 ? item.amount / total * 100 : 0,
                color: chartColors[index] || `hsl(${Math.round(index * 137.508) % 360} 65% 48%)`
            })),
            total,
            transactionCount: items.reduce((sum, item) => sum + item.count, 0)
        };
    }

    function escapeCategoryChartHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatCategoryChartAmount(value) {
        if (typeof formatAmount === "function") return formatAmount(value);
        return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value);
    }

    function piePoint(angleDegrees) {
        const radians = (angleDegrees - 90) * Math.PI / 180;
        return {
            x: 50 + 49 * Math.cos(radians),
            y: 50 + 49 * Math.sin(radians)
        };
    }

    function createPieSliceSvg(item, startAngle, endAngle) {
        const category = escapeCategoryChartHtml(item.category);
        const tooltipText = escapeCategoryChartHtml(
            `${item.category}: ${formatCategoryChartAmount(item.amount)} Ft · ${item.percentage.toFixed(1)}% · ${item.count} db`
        );
        const common = `class="category-pie-slice" fill="${item.color}" tabindex="0" ` +
            `role="img" aria-label="${tooltipText}" data-tooltip="${tooltipText}"`;

        if (endAngle - startAngle >= 359.999) {
            return `<circle cx="50" cy="50" r="49" ${common}><title>${tooltipText}</title></circle>`;
        }

        const start = piePoint(startAngle);
        const end = piePoint(endAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        const path = [
            "M 50 50",
            `L ${start.x.toFixed(5)} ${start.y.toFixed(5)}`,
            `A 49 49 0 ${largeArc} 1 ${end.x.toFixed(5)} ${end.y.toFixed(5)}`,
            "Z"
        ].join(" ");
        return `<path d="${path}" ${common}><title>${tooltipText}</title></path>`;
    }

    function bindPieSliceTooltips(chart) {
        const tooltip = chart.querySelector(".category-pie-tooltip");
        if (!tooltip) return;

        const show = (slice, clientX, clientY) => {
            tooltip.textContent = slice.getAttribute("data-tooltip") || "";
            tooltip.classList.remove("hidden");
            const rect = chart.getBoundingClientRect();
            const x = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
            const y = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
            tooltip.style.left = `${Math.max(12, Math.min(rect.width - 12, x))}px`;
            tooltip.style.top = `${Math.max(12, Math.min(rect.height - 12, y))}px`;
        };
        const hide = () => tooltip.classList.add("hidden");

        chart.querySelectorAll(".category-pie-slice").forEach(slice => {
            slice.addEventListener("mouseenter", event => show(slice, event.clientX, event.clientY));
            slice.addEventListener("mousemove", event => show(slice, event.clientX, event.clientY));
            slice.addEventListener("mouseleave", hide);
            slice.addEventListener("focus", () => show(slice));
            slice.addEventListener("blur", hide);
        });
    }

    function renderCategoryChart(rows) {
        const result = aggregateTransactionsByCategory(rows);
        const chart = document.getElementById("categoryPieChart");
        const legend = document.getElementById("categoryChartLegend");
        const summary = document.getElementById("categoryChartSummary");
        const empty = document.getElementById("categoryChartEmpty");
        const content = document.getElementById("categoryChartContent");
        if (!chart || !legend || !summary || !empty || !content) return result;

        summary.textContent = `${result.transactionCount} tranzakció, összesen ${formatCategoryChartAmount(result.total)} Ft – az aktuális szűrés alapján`;
        const hasData = result.items.length > 0 && result.total > 0;
        empty.classList.toggle("hidden", hasData);
        content.classList.toggle("hidden", !hasData);
        if (!hasData) {
            chart.innerHTML = "";
            legend.innerHTML = "";
            return result;
        }

        let startAngle = 0;
        const slices = result.items.map(item => {
            const endAngle = startAngle + item.percentage / 100 * 360;
            const slice = createPieSliceSvg(item, startAngle, endAngle);
            startAngle = endAngle;
            return slice;
        });
        chart.innerHTML = `
            <svg class="category-pie-svg" viewBox="0 0 100 100" aria-label="Kategóriánkénti tortadiagram">
                ${slices.join("")}
            </svg>
            <div class="category-pie-tooltip hidden" role="tooltip"></div>
        `;
        bindPieSliceTooltips(chart);
        chart.setAttribute(
            "aria-label",
            result.items.map(item => `${item.category}: ${item.percentage.toFixed(1)}%`).join(", ")
        );

        legend.innerHTML = result.items.map(item => `
            <div class="category-chart-legend-row">
                <span class="category-chart-swatch" style="background:${item.color}"></span>
                <span class="category-chart-label" title="${escapeCategoryChartHtml(item.category)}">
                    ${escapeCategoryChartHtml(item.category)}
                </span>
                <span class="category-chart-value">
                    ${escapeCategoryChartHtml(formatCategoryChartAmount(item.amount))} Ft
                    <small>${item.percentage.toFixed(1)}% · ${item.count} db</small>
                </span>
            </div>
        `).join("");
        return result;
    }

    function closeCategoryChart() {
        document.getElementById("categoryChartModal")?.classList.remove("open");
        document.getElementById("categoryChartOverlay")?.classList.remove("open");
    }

    async function openCategoryChart() {
        const button = document.getElementById("openCategoryChartBtn");
        const originalText = button?.textContent || "Kategória diagram";
        if (button) {
            button.disabled = true;
            button.textContent = "Diagram betöltése...";
        }
        try {
            const bridge = window.transactionsPageBridge;
            if (!Array.isArray(bridge?.getCache?.())) await bridge?.load?.(false);
            const rows = bridge?.getFiltered?.() || [];
            renderCategoryChart(rows);
            document.getElementById("categoryChartOverlay")?.classList.add("open");
            document.getElementById("categoryChartModal")?.classList.add("open");
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    }

    document.getElementById("openCategoryChartBtn")?.addEventListener("click", openCategoryChart);
    document.getElementById("closeCategoryChartBtn")?.addEventListener("click", closeCategoryChart);
    document.getElementById("categoryChartOverlay")?.addEventListener("click", closeCategoryChart);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.getElementById("categoryChartModal")?.classList.contains("open")) {
            closeCategoryChart();
        }
    });

    window.transactionsCategoryChart = { aggregateTransactionsByCategory, renderCategoryChart };
})();
