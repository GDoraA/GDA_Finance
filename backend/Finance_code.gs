/* ======================================================================
   GDA Finance – JSONP kompatibilis backend (file:// támogatás)
   ====================================================================== */

function doGet(e) { return handleRequest("GET", e); }
function doPost(e) { return handleRequest("POST", e); }
function doOptions(e) { return handleRequest("OPTIONS", e); }


function handleRequest(method, e) {
  var callback = e.parameter.callback;
  var table = e.parameter.table;

  // OPTIONS preflight — JSONP-nél nem számít, de legyen üres válasz
  if (method === "OPTIONS") {
    return HtmlService.createHtmlOutput("");
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(table);
    if (!sheet) throw "Sheet not found: " + table;

    // GET = adat lekérés
    if (method === "GET") {
      var rows = readSheet_(sheet);
      return jsonp(callback, { status: "success", rows: rows });
    }

    // POST = új sor beszúrása
    if (method === "POST") {
      var body = JSON.parse(e.postData.contents);
      appendRow_(sheet, body.data);
      return jsonp(callback, { status: "success" });
    }

  } catch (err) {
    return jsonp(callback, { status: "error", error: String(err) });
  }
}


/* ======================================================================
   JSONP válaszgenerátor
   ====================================================================== */

function jsonp(callback, obj) {
  var output = callback + "(" + JSON.stringify(obj) + ");";
  return HtmlService.createHtmlOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/* ======================================================================
   SEGÉDFÜGGVÉNYEK
   ====================================================================== */

// Sheet beolvasása objektumok listájába
function readSheet_(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();

  return values.map(row => {
    var o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}


// Új sor hozzáadása header alapján
function appendRow_(sheet, data) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var row = headers.map(h =>
    data[h] !== undefined ? data[h] : ""
  );

  sheet.appendRow(row);
}
