/* GDA Finance – JSONP alapú API (local file:// támogatással)
   ---------------------------------------------------------------
   Ez a verzió NEM használ fetch-et, hanem JSONP script betöltést,
   így teljesen CORS-mentes és működik file:// környezetben is.
*/

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxyYASvUqLpe2cAZPQVwGEuhTaZPv8LvCYCNuHb7bs3H0jz4nd3cUcndwmOFA1PkWA/exec";  // ← ide tedd be a GAS WebApp URL-t

/* ---------------------------------------------------------------
   Tranzakció mentése JSONP segítségével
--------------------------------------------------------------- */
function saveTransaction(data) {
    return new Promise((resolve, reject) => {

        const callbackName = "jsonp_callback_" + Math.random().toString(36).substr(2, 9);

        // Globális callback definiálása
        window[callbackName] = function(response) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(response);
        };

        // Script elem létrehozása JSONP híváshoz
        const script = document.createElement("script");
        script.src =
            BACKEND_URL +
            "?callback=" + callbackName +
            "&table=Transactions" +
            "&data=" + encodeURIComponent(JSON.stringify(data));

        script.onerror = (err) => {
            delete window[callbackName];
            reject(err);
        };

        // Script beszúrása → ekkor indul a hívás
        document.body.appendChild(script);
    });
}

/* ---------------------------------------------------------------
   Tranzakciók lekérése (GET) JSONP módszerrel
--------------------------------------------------------------- */
function fetchTransactions() {
    return new Promise((resolve, reject) => {

        const callbackName = "jsonp_callback_" + Math.random().toString(36).substr(2, 9);

        window[callbackName] = function(response) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(response.rows || response);
        };

        const script = document.createElement("script");
        script.src =
            BACKEND_URL +
            "?callback=" + callbackName +
            "&table=Transactions";

        script.onerror = reject;

        document.body.appendChild(script);
    });
}
