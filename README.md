# GDA Finance

## Cél

A GDA Finance egy böngészőben futó pénzügyi nyilvántartó alkalmazás, amely Google Apps Script backendhez kapcsolódik JSONP alapú API-hívásokon keresztül.

Az alkalmazás fő céljai:

- tranzakciók nyilvántartása,
- megosztott költségek kezelése,
- banki tranzakciók importálása,
- banki tételek és rögzített tranzakciók párosítása,
- havi pénzügyi összesítők megjelenítése,
- felhasználók és jogosultságok adminisztrációja.

## Fő technológiai felépítés

A projekt frontend oldala statikus HTML, CSS és JavaScript fájlokból áll. A backend Google Apps Script környezetben fut, és a frontend a `scripts/api.js` fájlban definiált JSONP kliensen keresztül kommunikál vele.

## Futtatás és telepítés

### Frontend futtatása

A frontend statikus fájlokból áll, ezért helyi vagy hosztolt statikus környezetben futtatható.

Belépési pont:

- `index.html`

A fő HTML fájl tölti be az alkalmazás oldalstruktúráját, a navigációt, a tranzakciós nézeteket, a bank import felületet, a riportokat és az adminisztrációs oldalakat.

Ajánlott futtatási mód:

1. a projekt fájljainak kiszolgálása statikus webszerverként,
2. az `index.html` megnyitása böngészőben,
3. bejelentkezés egy olyan felhasználóval, amely szerepel a Google Sheets / Apps Script backend által használt `Users` adatok között.

Megjegyzés: PWA funkciókhoz és manifest betöltéshez HTTP/HTTPS környezet javasolt. A `file://` alapú megnyitás fejlesztési ellenőrzésre használható, de nem minden böngészős funkció viselkedik ugyanúgy.

### Backend telepítése

A backend Google Apps Script környezetben fut.

Backend forrás:

- `Finance_codegs.txt`

A backend fő belépési pontja a `doGet(e)` függvény, amely az `action` paraméter alapján irányítja tovább a kéréseket.

A frontend az API-t a `scripts/api.js` fájlban beállított `API_URL` címen keresztül hívja.

Telepítési ellenőrzési pontok:

1. a Google Apps Script projekt Web Appként legyen publikálva,
2. az Apps Script Web App URL egyezzen a `scripts/api.js` fájlban szereplő `API_URL` értékkel,
3. a Google Sheets munkalapok elérhetők legyenek a script számára,
4. a szükséges munkalapok és fejlécoszlopok létezzenek,
5. a bejelentkezéshez használt felhasználó rendelkezzen megfelelő jogosultságokkal.

### PWA és cache

Az alkalmazás PWA jellegű konfigurációt is tartalmaz:

- `manifest.json`
- `service-worker.js`
- `icons/icon-192.png`
- `icons/icon-512.png`

A service worker statikus fájlokat cache-el. Ha frontend fájl módosul, a cache verzióját is ellenőrizni kell a `service-worker.js` fájlban, különben a böngésző régi fájlokat szolgálhat ki.

## Fő fájlok és modulok

### Alkalmazás belépési pontok

- `index.html`  
  Az alkalmazás fő HTML szerkezete. Tartalmazza a bejelentkezési felületet, az oldalsávot, a tranzakciós nézetet, a bank import felületet, a riportokat és az admin felületek alap HTML elemeit.

- `styles.css`  
  Az alkalmazás közös megjelenési szabályai: layout, táblázatok, modalok, reszponzív nézetek, gombok és státuszüzenetek.

- `app.js`  
  Általános inicializálás és közös képernyőlogika. Betölti az értékkészleteket, és kezeli a globálisabb frontend állapot egy részét.

### API és backend

- `scripts/api.js`  
  Frontend API kliens. JSONP alapú kommunikációt biztosít a Google Apps Script backend felé.

- `Finance_codegs.txt`  
  Google Apps Script backend kód. Tartalmazza az authentikációt, jogosultságkezelést, tranzakciós műveleteket, banki tranzakciók kezelését és az API `doGet` belépési pontját.

### UI és navigáció

- `ui/sidebar.js`  
  Oldalsáv, mobil/desktop menükezelés és oldalak közötti váltás.

- `ui/page-bootstrap.js`  
  Oldalváltási események központi kezelése. A modulok page bridge interfészein keresztül tölti be az adott nézeteket.

- `ui/modals.js`  
  Tranzakciós modalok és kapcsolódó felületi interakciók kezelése.

### Funkcionális modulok

- `features/transactions.js`  
  Tranzakciólista, szűrés, rendezés, cache, banki tétel hozzárendelés és egyenlegszámítás.

- `features/sharedExp.js`  
  Megosztott költségek listázása, rendezése, egyenlegszámítása és modal alapú kezelése.

- `features/bank-import.js`  
  Banki fájlok importálása, előnézet, banki tétel részletek és készpénzfelvétel / készpénzbefizetés alapú tranzakció-létrehozás.

- `features/reports-monthly-summary.js`  
  Havi összesítő riport előállítása és rendezhető táblázatos megjelenítése.

- `features/reports-bank-matching.js`  
  Banki párosítási riport, nyitott / figyelmen kívül hagyott tételek kezelése és lapozása.

- `features/value-sets.js`  
  Értékkészletek megjelenítése, szűrése, rendezése és lapozása.

- `features/admin.js`  
  Felhasználók, funkciók és jogosultságok adminisztrációs nézetei.

- `features/auth.js`  
  Bejelentkezés, kijelentkezés, session ellenőrzés és induló oldal kiválasztása jogosultság alapján.

### Közös segédek

- `utils/helpers.js`  
  Dátum-, összeg-, HTML-escape- és egyéb közös segédfüggvények.

- `utils/pagination.js`  
  Közös lapozási segédfüggvények.

### PWA / cache

- `service-worker.js`  
  Alkalmazás fájlok cache-elése és SPA navigáció támogatása.

- `manifest.json`  
  PWA manifest: alkalmazásnév, ikonok és standalone megjelenítés konfigurációja.

## Fejlesztési alapelvek

A projektben a változtatásokat kis, önállóan ellenőrizhető lépésekben érdemes végrehajtani.

Elsődleges szempontok:

1. helyesség,
2. biztonság,
3. teljesítmény,
4. olvashatóság.

Több fájlt érintő módosításnál kerülni kell az olyan átállást, amely részleges fájlszinkron esetén futásképtelen állapotot okozhat.

## Tesztelés és ellenőrzés

A projekt jelenlegi formájában elsősorban kézi, böngészős ellenőrzéssel tesztelhető. Automatizált tesztfuttató vagy build folyamat nincs dokumentálva a projektben.

### Jogosultsági tesztek

A jogosultsági modell statikus ellenőrzése:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\permissions-static.ps1
```

A `tests/permissions.test.html` fájl böngészőben megnyitva ellenőrzi a
`none`, `read`, `write`, admin és oldalválasztási szabályokat. Sikeres futásnál
az oldal alján `ALL TESTS PASSED` jelenik meg.

Az Apps Script és a Google Sheets adatokkal végzett teljes integrációs tesztet
mindig külön táblamásolaton és külön teszt deploymenten kell futtatni.

### Alap indítási ellenőrzés

1. Nyisd meg az `index.html` fájlt HTTP/HTTPS környezetben.
2. Ellenőrizd, hogy megjelenik a bejelentkezési oldal.
3. Jelentkezz be érvényes felhasználóval.
4. Ellenőrizd, hogy sikeres belépés után az oldalsáv és a tartalmi nézet megjelenik.
5. Ellenőrizd, hogy kijelentkezés után visszakerülsz a bejelentkezési oldalra.

### Jogosultság és navigáció

1. Jelentkezz be eltérő jogosultságú felhasználókkal.
2. Ellenőrizd, hogy csak az elérhető funkciók jelennek meg az oldalsávban.
3. Kattints végig minden elérhető menüponton.
4. Ellenőrizd, hogy az oldalváltások nem okoznak JavaScript hibát.
5. Ellenőrizd, hogy az adott oldalhoz tartozó lista vagy státuszüzenet betöltődik.

Érintett fájlok:

- `features/auth.js`
- `ui/sidebar.js`
- `ui/page-bootstrap.js`

### Tranzakciók ellenőrzése

1. Nyisd meg a `Tranzakciók` oldalt.
2. Ellenőrizd, hogy a tranzakciólista betöltődik.
3. Próbáld ki a szűrést hónap, dátum, összeg, megnevezés, kategória és fizetési mód alapján.
4. Próbáld ki a táblázat rendezését.
5. Nyiss meg egy meglévő tranzakciót szerkesztésre.
6. Ellenőrizd, hogy a banki tétel hozzárendelő mező a megfelelő tételeket kínálja fel.
7. Ments egy módosítást, majd töltsd újra a listát.
8. Ellenőrizd, hogy a módosítás megmaradt.

Érintett fájlok:

- `features/transactions.js`
- `ui/modals.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Megosztott költségek ellenőrzése

1. Nyisd meg a `Megosztott költségek` oldalt.
2. Ellenőrizd, hogy a lista betöltődik.
3. Ellenőrizd a részösszegek és egyenlegek megjelenítését.
4. Hozz létre új megosztott tételt.
5. Hozz létre új törlesztés tételt.
6. Ellenőrizd, hogy a lista újratöltés után is konzisztens.
7. Ellenőrizd, hogy csak a megengedett tételek törölhetők.

Érintett fájlok:

- `features/sharedExp.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Bank import ellenőrzése

1. Nyisd meg a `Bank import` oldalt.
2. Válassz ki egy támogatott banki import fájlt.
3. Ellenőrizd, hogy az előnézet megjelenik.
4. Ellenőrizd, hogy hibás sorok esetén megjelenik a hibalista.
5. Indíts importot.
6. Ellenőrizd, hogy a banki tételek listája frissül.
7. Nyiss meg egy banki tétel részletező modalját.
8. Készpénzfelvétel vagy készpénzbefizetés típusú tételnél ellenőrizd a tranzakció-létrehozási gomb működését.

Érintett fájlok:

- `features/bank-import.js`
- `features/transactions.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Párosítás riport ellenőrzése

1. Nyisd meg a `Párosítás riport` oldalt.
2. Ellenőrizd az összesített darabszámokat.
3. Válts az open és ignored nézetek között.
4. Próbáld ki a lapozást.
5. Jelölj egy tételt ignored státuszúként.
6. Ellenőrizd, hogy a státusz frissítés után is megmarad.

Érintett fájlok:

- `features/reports-bank-matching.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Havi összesítő ellenőrzése

1. Nyisd meg a `Havi összesítő` oldalt.
2. Ellenőrizd, hogy a havi sorok megjelennek.
3. Ellenőrizd a bevétel, kiadás, megtakarítás, havi egyenleg és kumulált egyenleg értékeit.
4. Próbáld ki a rendezést minden támogatott oszlopon.
5. Ellenőrizd, hogy az összesítő sor értékei konzisztensnek tűnnek.

Érintett fájlok:

- `features/reports-monthly-summary.js`
- `features/transactions.js`

### Értékkészletek ellenőrzése

1. Nyisd meg az `Értékkészletek` oldalt.
2. Válassz kategóriát.
3. Ellenőrizd, hogy a lista betöltődik.
4. Próbáld ki a szűrést.
5. Próbáld ki a lapozást.
6. Ellenőrizd, hogy az új érték hozzáadása után a lista frissül.

Érintett fájlok:

- `features/value-sets.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Admin felületek ellenőrzése

1. Admin jogosultságú felhasználóval nyisd meg az admin oldalakat.
2. Ellenőrizd a felhasználók listáját.
3. Ellenőrizd a funkciók listáját.
4. Ellenőrizd a jogosultságok listáját.
5. Módosíts egy jogosultságot.
6. Jelentkezz be az érintett felhasználóval, és ellenőrizd, hogy a jogosultságváltozás érvényesül.

Érintett fájlok:

- `features/admin.js`
- `features/auth.js`
- `scripts/api.js`
- `Finance_codegs.txt`

### Service worker és cache ellenőrzése

1. HTTP/HTTPS környezetben nyisd meg az alkalmazást.
2. Ellenőrizd a böngésző DevTools Application paneljén, hogy a service worker regisztrálódott-e.
3. Frontend fájl módosítása után ellenőrizd, hogy a `service-worker.js` cache verziója frissült-e.
4. Ellenőrizd hard refresh után, hogy nem régi JavaScript vagy CSS fájl fut-e.

Érintett fájlok:

- `service-worker.js`
- `manifest.json`
- `index.html`

## Szinkronizálási megjegyzés

A projektben a fájlok időszakosan frissülhetnek / szinkronizálódhatnak, ezért a több fájlt érintő módosításokat mini release-ekben kell kezelni.

A cél az, hogy részlegesen frissült állapotban se váljon az alkalmazás teljesen használhatatlanná.

### Ajánlott bevezetési sorrend

1. visszafelé kompatibilis módosítás,
2. új belépési pont, bridge vagy adapter bevezetése,
3. fogyasztó oldali átállás,
4. ellenőrzés éleshez közeli adatokkal,
5. régi ág eltávolítása csak külön validálás után.

### Több fájlt érintő módosítások szabályai

Több fájlt érintő módosításnál mindig külön kell azonosítani:

- melyik fájl ad új API-t, bridge-et vagy helper függvényt,
- melyik fájl kezdi el használni az új működést,
- van-e fallback, ha az egyik fájl már frissült, a másik még nem,
- kell-e service worker cache verziót emelni,
- kell-e Google Apps Script deploymentet frissíteni.

### Tipikus együtt frissítendő fájlcsoportok

#### Frontend API és backend

Együtt kezelendő fájlok:

- `scripts/api.js`
- `Finance_codegs.txt`

Kockázat:

- ha a frontend új `action` értéket hív, de a backend még nem ismeri, akkor az API `Ismeretlen action` hibával térhet vissza;
- ha a backend új kötelező paramétert vár, de a frontend még nem küldi, akkor a művelet hibával leállhat.

Biztonságos sorrend:

1. backend tegye elfogadhatóvá az új paramétert opcionálisan,
2. frontend kezdje el küldeni az új paramétert,
3. csak később legyen kötelező az új mező.

#### Oldalváltás és feature modulok

Együtt kezelendő fájlok:

- `ui/sidebar.js`
- `ui/page-bootstrap.js`
- adott `features/*.js` modul

Kockázat:

- ha a sidebar már új oldaleseményt küld, de a page bootstrap vagy a feature modul még nem kezeli, az oldal nem tölt be;
- ha a feature modul új bridge interfészt vár, de a page bootstrap még legacy hívást használ, részleges működés vagy dupla betöltés jelentkezhet.

Biztonságos sorrend:

1. feature modulban bridge vagy fallback bevezetése,
2. page bootstrap átvezetése az új bridge használatára,
3. sidebar esemény vagy navigáció módosítása,
4. legacy fallback eltávolítása csak külön ellenőrzés után.

#### Tranzakciók és banki tételek

Együtt kezelendő fájlok:

- `features/transactions.js`
- `features/bank-import.js`
- `features/reports-bank-matching.js`
- `scripts/api.js`
- `Finance_codegs.txt`

Kockázat:

- a tranzakciók és banki tételek közötti kapcsolat több helyen a `statement_item`, banki tétel ID és párosítási státusz alapján épül;
- részleges frissítés esetén a lista, a modal és a párosítás riport eltérő állapotot mutathat.

Biztonságos sorrend:

1. backend és API legyen kompatibilis a régi és új mezőhasználattal is,
2. tranzakciós cache és banki cache kezelése maradjon kompatibilis,
3. riportok csak ezután támaszkodjanak az új mezőre vagy új státuszra.

#### PWA és statikus frontend fájlok

Együtt kezelendő fájlok:

- `service-worker.js`
- `index.html`
- `styles.css`
- `app.js`
- `features/*.js`
- `ui/*.js`
- `utils/*.js`
- `manifest.json`

Kockázat:

- ha frontend fájl módosul, de a service worker cache verziója nem változik, a böngésző régi JavaScript vagy CSS fájlt szolgálhat ki;
- ha az asset lista nem tartalmaz egy új fájlt, offline vagy cache-elt működésnél hiányzó fájlhiba jelentkezhet.

Biztonságos sorrend:

1. statikus fájl módosítása,
2. `service-worker.js` asset lista ellenőrzése,
3. cache verzió emelése, ha a böngészőnek biztosan új fájlokat kell letöltenie,
4. hard refresh / service worker unregister ellenőrzés tesztkörnyezetben.

## Rollback irányelvek

Rollback esetén mindig a legkisebb visszavonható egységet kell visszaállítani.

### Dokumentációs módosítás rollback

Érintett fájl:

- `README.md`

Teendő:

- állítsd vissza a korábbi README verziót;
- futtatási teszt nem szükséges, mert nincs működő kódváltozás.

### Frontend-only rollback

Érintett fájlok lehetnek:

- `index.html`
- `styles.css`
- `app.js`
- `features/*.js`
- `ui/*.js`
- `utils/*.js`
- `service-worker.js`

Teendő:

1. állítsd vissza az érintett frontend fájlokat,
2. ellenőrizd a service worker cache verzióját,
3. hard refresh után ellenőrizd a böngészőben futó verziót,
4. teszteld a módosított funkcióhoz tartozó oldalt.

### Backend rollback

Érintett fájl:

- `Finance_codegs.txt`

Teendő:

1. állítsd vissza az előző Apps Script verziót,
2. publikáld újra a Web Appot, ha szükséges,
3. ellenőrizd, hogy a frontend `API_URL` továbbra is a megfelelő deploymentre mutat,
4. teszteld legalább a bejelentkezést és az érintett API műveletet.

### API-szerződést érintő rollback

Érintett fájlok:

- `scripts/api.js`
- `Finance_codegs.txt`
- az érintett feature modul

Teendő:

1. először a backend maradjon kompatibilis a régi frontenddel,
2. csak ezután állítsd vissza a frontend hívást,
3. ellenőrizd, hogy a régi és új kliensállapot nem keveredik-e a böngésző cache miatt,
4. szükség esetén emeld vagy állítsd vissza a service worker cache verziót is.

### Minimum rollback ellenőrzés

Rollback után legalább ezt kell ellenőrizni:

1. bejelentkezés működik,
2. oldalsáv megjelenik,
3. tranzakciólista betöltődik,
4. érintett funkció nem dob JavaScript hibát,
5. backend válaszban nincs jogosultsági vagy `action` hiba,
6. hard refresh után is ugyanaz az állapot látható.

## Ellenőrzési minimum

Dokumentációs módosítás után elegendő ellenőrizni, hogy:

- a `README.md` megnyitható és olvasható,
- minden felsorolt fájl ténylegesen létezik a projektben,
- a README nem hivatkozik még nem létező funkcióra,
- nincs működő kódot érintő módosítás.
