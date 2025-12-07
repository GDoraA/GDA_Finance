// ----------- API KONFIG -------------

const API_URL = "https://script.google.com/macros/s/AKfycbxzzoI1m5TXQ_yCUa1ohpvTc55v-dzFX_EZLVaqn7LzE4m2scnMt1p944eFmWE8YGo/exec";


// ----------- JSONP HÍVÓ FUNKCIÓ -------------

function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {

        const callbackName = "cb_" + Date.now() + "_" + Math.floor(Math.random()*10000);

        window[callbackName] = function(response) {
            delete window[callbackName];
            script.remove();
            resolve(response);
        };

        const urlParams = new URLSearchParams({ action, callback: callbackName, _: Date.now() });
        Object.entries(params).forEach(([k, v]) => urlParams.set(k, v));

        const script = document.createElement("script");
        script.src = `${API_URL}?${urlParams.toString()}`;
        script.onerror = () => reject("JSONP hiba");

        document.body.appendChild(script);
    });
}


// ----------- API METÓDUSOK -------------

const api = {
    addTransaction(data) {
        return jsonp("addTransaction", data);
    },

    getTransactions() {
        return jsonp("getTransactions");
    },

    updateTransaction(data) {
    return jsonp("updateTransaction", data);
    },

    getValueSets() {
        return jsonp("getValueSets");
    }
};

