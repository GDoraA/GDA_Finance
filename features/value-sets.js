let valueSetsSort = { field: "value", dir: "asc" };
let valueSetsPage = 1;
function renderValueSetsTable(list) {
    const tbody = document.querySelector("#valueSetsTable tbody");
    const filterInput = document.getElementById("valueSetFilterText");
    const itemsPerPageSelect = document.getElementById("valueSetItemsPerPage");
    const pagination = document.getElementById("valueSetsPagination");
    if (!tbody) return;
    let items = Array.isArray(list) ? list : [];
    // SZŰRÉS
    const filter = (filterInput?.value || "").toLowerCase().trim();
    if (filter) {
        items = items.filter(v => String(v ?? "").toLowerCase().includes(filter));
    }
    // RENDEZÉS
    items.sort((a, b) => {
        const av = String(a ?? "").toLowerCase();
        const bv = String(b ?? "").toLowerCase();
        if (av < bv) return valueSetsSort.dir === "asc" ? -1 : 1;
        if (av > bv) return valueSetsSort.dir === "asc" ? 1 : -1;
        return 0;
    });
    // LAPOZÁS
    const itemsPerPage = Math.max(1, Number(itemsPerPageSelect?.value || 20));
    const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
    if (valueSetsPage > totalPages) valueSetsPage = totalPages;
    const start = (valueSetsPage - 1) * itemsPerPage;
    const pagedItems = items.slice(start, start + itemsPerPage);
    tbody.innerHTML = pagedItems
        .map(v => `<tr><td>${escapeHtml(String(v ?? "").trim())}</td></tr>`)
        .join("");
    const resultCount = document.getElementById("valueSetResultCount");
    if (resultCount) {
        resultCount.textContent = `${items.length} érték • ${valueSetsPage}/${totalPages} oldal`;
    }
    if (pagination) {
        pagination.innerHTML = `
            <button type="button" ${valueSetsPage <= 1 ? "disabled" : ""} data-page="prev">Előző</button>
            <span>${valueSetsPage} / ${totalPages}</span>
            <button type="button" ${valueSetsPage >= totalPages ? "disabled" : ""} data-page="next">Következő</button>
        `;
        pagination.querySelector('[data-page="prev"]')?.addEventListener("click", () => {
            if (valueSetsPage > 1) {
                valueSetsPage--;
                renderValueSetsTable(list);
            }
        });
        pagination.querySelector('[data-page="next"]')?.addEventListener("click", () => {
            if (valueSetsPage < totalPages) {
                valueSetsPage++;
                renderValueSetsTable(list);
            }
        });
    }
}
async function loadValueSetsPage() {
const categorySelect = document.getElementById("valueSetCategorySelect");
const resultCount = document.getElementById("valueSetResultCount");
const tableBody = document.querySelector("#valueSetsTable tbody");
    if (!categorySelect) return;
let res;

try {
    res = await api.getValueSetsDetailed();
} catch (err) {
    console.error("getValueSetsDetailed failed:", err);

if (resultCount) resultCount.textContent = "Hálózati hiba történt";

// UI reset (sync-safe fallback)
if (tableBody) tableBody.innerHTML = "";

    return;
}

if (!res || !res.success) {
    console.warn("getValueSetsDetailed unsuccessful response:", res);

if (resultCount) resultCount.textContent = "Hiba a betöltés során";

// UI reset
if (tableBody) tableBody.innerHTML = "";

    return;
}
    const categories = Array.isArray(res.categories) ? res.categories : [];
    const itemsByCategory = res.itemsByCategory || {};
    if (!categorySelect.dataset.initialized) {
        categorySelect.innerHTML = categories
            .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("");
        const filterInput = document.getElementById("valueSetFilterText");
        if (filterInput && !filterInput.dataset.initialized) {
            filterInput.addEventListener("input", () => {
                valueSetsPage = 1;
                const selected = categorySelect.value;
                const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
                renderValueSetsTable(list);
            });
            filterInput.dataset.initialized = "1";
        }
        const itemsPerPageSelect = document.getElementById("valueSetItemsPerPage");
        if (itemsPerPageSelect && !itemsPerPageSelect.dataset.initialized) {
            itemsPerPageSelect.addEventListener("change", () => {
                valueSetsPage = 1;
                const selected = categorySelect.value;
                const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
                renderValueSetsTable(list);
            });
            itemsPerPageSelect.dataset.initialized = "1";
        }
        categorySelect.addEventListener("change", () => {
            valueSetsPage = 1;
            const selected = categorySelect.value;
            const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
            renderValueSetsTable(list);
        });
        categorySelect.dataset.initialized = "1";
    }
    const selected = categorySelect.value || categories[0] || "";
    if (selected && !categorySelect.value) {
        categorySelect.value = selected;
    }
    const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
    renderValueSetsTable(list);
    const th = document.querySelector("#valueSetsTable thead th[data-sort]");
    if (th && !th.dataset.initialized) {
        th.addEventListener("click", () => {
            valueSetsSort.dir = valueSetsSort.dir === "asc" ? "desc" : "asc";
            const categorySelect = document.getElementById("valueSetCategorySelect");
            const selected = categorySelect?.value;
            const list = Array.isArray(itemsByCategory[selected]) ? itemsByCategory[selected] : [];
            renderValueSetsTable(list);
        });
        th.dataset.initialized = "1";
    }
}
window.loadValueSetsPage = loadValueSetsPage;