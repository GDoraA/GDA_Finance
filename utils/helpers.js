// YYYY-MM from date string
function getMonthString(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ISO timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// JSONP hívás Apps Scripthez
function jsonp(url) {
    return new Promise((resolve, reject) => {
        const callbackName =
            "jsonp_cb_" + Date.now() + "_" + Math.random().toString(36).substring(2);

        window[callbackName] = (data) => {
            resolve(data);
            delete window[callbackName];
            script.remove();
        };

        const script = document.createElement("script");
        const sep = url.includes("?") ? "&" : "?";
        script.src = `${url}${sep}callback=${callbackName}`;
        script.onerror = reject;

        document.body.appendChild(script);
    });
}
