const API_BASE = "https://script.google.com/macros/s/AKfycbxkvmqQoWG83xNsQWMe_LgMXxv0ZEMJlPaboH2O7nTgi4rjpvieW_b29ldsAqgOLyI/exec";

const api = {

    addItem(item) {
        const params = new URLSearchParams({
            action: "addItem",
            ...item
        });
        return jsonp(`${API_BASE}?${params.toString()}`);
    },

    getList() {
        return jsonp(`${API_BASE}?action=getList`);
    },

    updateItem(item) {
        const params = new URLSearchParams({
            action: "updateItem",
            ...item
        });
        return jsonp(`${API_BASE}?${params.toString()}`);
    },

    deleteItem(id) {
        const params = new URLSearchParams({
            action: "deleteItem",
            id
        });
        return jsonp(`${API_BASE}?${params.toString()}`);
    },

    getUniqueLists() {
        return jsonp(`${API_BASE}?action=getUniqueLists`);
    }
};
