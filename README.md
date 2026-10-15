# GasAlert Training Simulator

Funkční výcviková aplikace pro společné prostředí a více mobilních detektorů. Instruktor nastavuje koncentrace na serveru, hasiči dostávají pouze současné simulované hodnoty a vlastní alarmy. Rozhraní a návody jsou česky.

**Veřejná aplikace:** https://gasalertsimulator-production.up.railway.app · [Produkční konfigurace a přístup](docs/NASAZENI.md)

**SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY.** Aplikace není certifikované měřidlo a nenahrazuje skutečný detektor při zásahu.

## Rychlé místní spuštění

Požadavky: Node.js 22.12+ nebo 24, npm, PostgreSQL. Závislosti jsou uzamčené v `package-lock.json`.

```powershell
npm ci
Copy-Item .env.example .env
```

V `.env` nastavte vlastní `DATABASE_URL` a `APP_ORIGIN`. Při použití Dockeru nastavte také silné `POSTGRES_PASSWORD` v prostředí a spusťte `docker compose up -d db`. Heslo v databázové URL musí odpovídat této proměnné (speciální znaky URL zakódujte).

```powershell
npm run db:generate
npm run db:migrate
$env:INSTRUCTOR_EMAIL = 'instruktor@vase-jednotka.cz'
$env:INSTRUCTOR_PASSWORD = 'zde-zadejte-vlastni-dlouhe-heslo'
npm run account:create
Remove-Item Env:INSTRUCTOR_PASSWORD
npm run dev
```

Otevřete `http://localhost:3000`. Účet není přednastaven, hesla jsou ukládána pomocí scrypt se samostatnou náhodnou solí. Vytvoření duplicitního účtu heslo nepřepíše.

### Varianta bez Dockeru na tomto počítači

```powershell
node scripts/local-db.mjs
```

Tento proces ponechte spuštěný. Založí lokální PostgreSQL 17 na `127.0.0.1:55432`, vygeneruje náhodné heslo a vytvoří `.env`, pokud ještě neexistuje. Databáze a údaje jsou v ignorované `.local/`. Existující `.env` se nepřepisuje. V dalším terminálu spusťte migrace, potom `npx tsx scripts/local-account.ts` a `npm run dev`. Náhodný lokální přístup najdete v `.local/PRISTUP.txt`. Lokální databáze není určena pro produkční nasazení.

Pro mobil v místní síti použijte dosažitelnou adresu PC a odpovídající `APP_ORIGIN`; QR odkaz používá adresu, na které instruktor skutečně otevřel aplikaci. `localhost` na telefonu odkazuje na telefon. Pro PWA a Wake Lock použijte HTTPS; lokální výjimka pro `localhost` se nevztahuje na IP adresu PC.

## Použití

1. Instruktor se přihlásí, zvolí profil a založí cvičení.
2. Přes „Připojit hasiče“ zobrazí kód, přímý odkaz a QR. Hasiči nepotřebují účty.
3. Každý hasič se připojí a dotykem aktivuje detektor i zvuk.
4. Instruktor zahájí cvičení. U CO zadá cíl 150 ppm a dobu 60 s, potvrdí „Nastavit“. Změna probíhá na serveru i při zavření jeho prohlížeče.
5. V ukázkovém profilu při překročení 35 ppm nastane LOW, při překročení 200 ppm HIGH. Hodnoty jsou výcvikové, nikoliv ověřená konfigurace vašeho kusu přístroje.
6. „Reset koncentrací“ obnoví O₂ 20,9 %, ostatní 0, zruší rampy a závady. Expozici a alarmovou paměť zachová. „Nový výcvikový cyklus“ výslovně resetuje expozice všech detektorů.
7. Po ukončení otevřete historii: průběh každého plynu, události a úplný JSON export včetně expozice jednotlivých účastníků.

Posuvník upravuje cílovou hodnotu; příkaz se odešle až tlačítkem „Nastavit“. Nulová doba znamená okamžitou změnu. Nenulová doba lineární růst nebo pokles. „Udržet“ zastaví změnu jednoho kanálu; „Zastavit všechny změny“ udrží všechny současné hodnoty. Pozastavení cvičení zastaví také simulační čas a expozici. Cvičení ve stavu „Připraveno“ čeká na zahájení.

Detektor: krátké C podsvítí a potvrdí povolený alarm; dvojstisk zobrazí postupně TWA, STEL, MAX a RESET. C během RESET vymaže pouze vlastní expozici (událost zůstane v historii). Podržení 3 s detektor vypne. V režimu expozice „od aktivace“ nová aktivace začíná novou historii; v režimu „do cyklu“ ji zachová. C nemění prostředí ani profil. Dlouhý stisk a časy obrazovek jsou výcviková aproximace. Kalibrace a nárazový test nejsou simulovány.

## Architektura a ukládání

- Next.js App Router, React, TypeScript, Tailwind 4; stránky `/`, `/instruktor`, `/detektor`.
- Jeden trvalý Node HTTP server v `server/index.ts`: Express API, Socket.IO a obsluha Next. Produkce spouští `node dist/index.js`, nikoliv statický export nebo `next start`.
- PostgreSQL + Prisma 6.19.3. Modely účtů, hashovaných relací, profilů, scénářů, cvičení, účastníků, sekundových vzorků, událostí a verzovaných hygienických referencí. SQL migrace jsou verzované.
- `server/runtime.ts`: autoritativní simulační čas, rampy, vlastní expozice a alarmová paměť každého účastníka. Operace jsou serializované; stav a vzorek se ukládají transakčně před odesláním nových hodnot. Alarmy a příkazy mají vlastní události.
- `src/lib/engine.ts`: samostatný deterministický modul alarmů, expozice a vývoje prostředí. Architektura odděluje prostředí od účastníka, takže později lze doplnit individuální prostředí.
- Instruktor má vlastní místnost Socket.IO; detektor dostává pouze explicitně sestavený veřejný snímek. Ten neobsahuje cíle, scénář, profil ani ostatní hasiče.
- Server ukládá simulační čas i reálný čas záznamu. Rychlosti 1×, 5×, 10×, 60× ovlivňují rampy i expozici. Výchozí režim 1:1.
- Každou sekundu checkpoint koncentrací, expozice a alarmů. Před explicitním resetem, novým cyklem či novou aktivací se předchozí expozice archivuje v příslušné události. Aktivovaný detektor se počítá i během přerušení klientského spojení; jde o serverovou simulovanou expozici, nikoli tvrzení, že telefon v pozadí fungoval.
- Po restartu běžící cvičení přejde do pozastavení, uloží se událost a označení neúplné expozice. Žádná domnělá expozice během výpadku serveru se nedopočítává. Prodleva simulační smyčky nad 5 s rovněž pozastaví běh. Selhání ukládání odpojí klienty a ukončí proces, aby server neposílal neuložený průběh.

Jedna instance je záměrná. Nezapínejte více replik: pro další škálování bude nutné oddělit autoritativní simulační proces, sdílený zámek a distribuční adaptér. Pro první verzi počítejte s menší jednotkou a řádově desítkami detektorů; výkonnostní zátěžový test nebyl proveden. Záznamy se automaticky nemažou, správce musí zajistit retenční pravidla a zálohy.

## Alarmy a výpočty

LOW, HIGH, TWA, STEL, MULTIGAS, OL, SENSOR ERROR, LOW BATTERY. Toxicita a LEL alarmují při hodnotě **vyšší** než práh; O₂ pod LOW nebo nad HIGH. Měřicí rozsahy simulace: O₂ 0–30 % obj., CO 0–500 ppm, H₂S 0–100 ppm, LEL 0–100 % LEL. Instruktor může záměrně nastavit nadrozsah pro OL. Žádný automatický převod LEL na objemová procenta.

Latching zachovává LOW/HIGH/OL do odeznění alarmu daného kanálu a potvrzení. Potvrzení LOW ztlumí jen zvuk CO/H₂S/LEL, pokud to profil dovolí; HIGH/TWA/STEL jej opět spustí. TWA/STEL mají vlastní paměť do resetu expozice. C může potvrdit zvuk závady senzoru; Err zůstane na displeji. Multigas znamená alespoň dva různé alarmující plyny.

Expozice je integrace simulované koncentrace v simulačních sekundách. TWA = dávka posledních 28 800 s / 28 800 s. STEL = dávka posledního okna / délka celého okna, 5–15 min, výchozí 15 min. Před aktivací se předpokládá nulová expozice. Pro první neúplné okno se nepoužívá dělení pouze uplynulou dobou. Jde o explicitně zvolenou výcvikovou numerickou metodu; přesné chování firmwaru při prvním okně nebylo změřeno. Vadný senzor se do dávky nepřičítá a expozice je trvale označena jako neúplná. Nepoužívejte tato čísla jako skutečný pracovnělékařský záznam.

Baterie je ručně nastavená výcviková hodnota; prah 10 % je výcviková volba. Nejde o skutečnou baterii telefonu. Automatické vypnutí po vybití a úplná servisní sekvence originálu nejsou implementovány. Zvuk pomalý/rychlý, multigas a LED jsou přibližné rytmy, nikoliv měřená reprodukce zařízení; detaily ověření jsou v `docs/ZDROJE.md`.

## Zabezpečení

Server kontroluje přihlášení, vlastnictví cvičení a role všech příkazů. Relace mají náhodný token, v DB pouze hash, cookie HttpOnly / SameSite Strict / Secure v produkci, platnost 12 h. Účastník má náhodný token pro návrat do vlastní historie. Kód je kryptograficky náhodný šestimístný, bez registrace, s omezením pokusů; kód není dlouhodobým tajemstvím a sdílejte jej pouze s výcvikovou skupinou. API i Socket.IO ověřují původ, požadavky mají velikostní limity, validaci a omezení frekvence. Relace a hesla nejsou v repozitáři. Zálohy obsahují osobní označení účastníků a musí mít odpovídající přístup.

## Testy a ověření

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
# Aplikace a PostgreSQL musí běžet; E2E vytváří svůj dočasný účet.
npm run test:e2e
npx prisma migrate status
```

Testy jsou v `tests/` a `e2e/`. E2E používá jeden instruktorský kontext a dva oddělené mobilní kontexty, serverový vývoj CO, LOW/HIGH, potvrzení, výpadek a návrat, zachování expozice při resetu, konec a historii; kontroluje i zneužití instruktorských příkazů detektorem. Dočasná data vlastního testovacího účtu po sobě odstraňuje. Nepouštějte E2E proti skutečnému výcvikovému provozu.

Konkrétní výsledky aktuálního ověření jsou v `docs/OVERENI.md`. Docker build a veřejné nasazení lze označit za ověřené až po skutečném spuštění v daném prostředí.

## PWA a mobilní omezení

Manifest obsahuje samostatné ikony, standalone zobrazení a identifikaci simulace. Android: instalace přes nabídku prohlížeče; iOS: Sdílet → Přidat na plochu. Vyžaduje HTTPS. Worker uchovává pouze offline chybovou stránku, nikdy API, přihlášení ani naměřené snímky. Zařízení bez spojení nezobrazuje stará čísla jako aktuální: do 4 s bez snímku zobrazí „PORUCHA SPOJENÍ – SIMULACE“ a zastaví zvuk. Socket.IO automaticky zkouší návrat a server vrátí vlastní aktuální historii účastníka.

První dotyk inicializuje Web Audio. Změna alarmu zvuk okamžitě přeruší a zvolí nový rytmus. Před aktivací lze zapnout/vypnout a vyzkoušet vibrace. Na podporovaných telefonech se při alarmu opakují pomalé, rychlé nebo kombinované výcvikové vibrace; potvrzení zvuku LOW je nevypne. Při ztrátě spojení, odchodu na pozadí, vypnutí nebo ukončení cvičení se zastaví. Prohlížeč bez Vibration API nabídne zvuk a LED, bez nefunkčního přepínače. Dostupnost API ještě nepotvrzuje přítomnost vibračního motoru; ověřte jej tlačítkem „Vyzkoušet vibrace“.

Tichý režim, hlasitost, audio výstup, telefonní hovor a pravidla iOS/Android mohou zvuk i vibrace omezit. **Při zamčení telefonu nelze slíbit zvuk, vibrace ani živé zobrazení.** Návrat z pozadí vyžaduje opětovný aktivační dotyk. Instruktor vidí stav aplikace na pozadí a odpojení. Wake Lock je pouze požadavek a prohlížeč jej smí odmítnout. Instalace, skutečný zvuk a hmatová odezva na konkrétních telefonech musí projít terénní kontrolou. [Dokumentace Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate).

Knihovna nově obsahuje **19 scénářů** včetně garáže, agregátu, šachty, ČOV, obohaceného kyslíku, pomalého/rychlého úniku, odvětrání a nadrozsahu. Podrobný seznam je v [docs/SCENARE.md](docs/SCENARE.md).

## Railway a GitHub

1. Založte soukromý GitHub repozitář, propojte tento adresář a odešlete soubory včetně lockfile a migrací. `.env` a `.local/` musí zůstat ignorované.
2. V Railway vytvořte projekt, přidejte PostgreSQL a aplikaci z GitHub repozitáře. Railway použije `Dockerfile` a `railway.toml`.
3. V aplikaci nastavte `DATABASE_URL` referencí na PostgreSQL a `APP_ORIGIN=https://vase-domena` přesně bez cesty. Vygenerujte veřejnou doménu. Railway předává `PORT`; server naslouchá na `0.0.0.0`.
4. Ponechte **jednu repliku**, zapnutý trvalý proces; nevypínejte jej při nečinnosti. Trvalá Socket.IO spojení běží na stejném portu jako web. Veřejné připojení musí být přes HTTPS/WSS.
5. Start kontejneru provede `prisma migrate deploy` a vlastní Node server. Healthcheck `/api/health` ověřuje dostupnost DB, ne pouze statickou stránku.
6. Pro první účet jednorázově spusťte `npm run account:create` **v prostředí s připojením k produkční DB**, s `INSTRUCTOR_EMAIL` a `INSTRUCTOR_PASSWORD` nastavenými jako tajné proměnné. Příkaz nepřepisuje existující účet. Poté heslo z prostředí odstraňte. Railway private URL není přístupná z běžného lokálního shellu; využijte prostředí služby nebo dočasné zabezpečené spojení k DB.
7. Ověřte přihlášení, dva fyzické telefony, QR připojení, LOW/HIGH, reconnect, zvuk a historii. Teprve poté nasazení považujte za dokončené. Po restartu musí instruktor pozastavený výcvik vědomě obnovit.

Projekt je propojen s [GitHubem](https://github.com/martypetrzel-lab/GasAlertsimulator) a nasazen na [Railway](https://gasalertsimulator-production.up.railway.app). Popis konkrétního produkčního prostředí je v `docs/NASAZENI.md`. První účet lze při startu bezpečně založit také z proměnných `BOOTSTRAP_INSTRUCTOR_EMAIL` a `BOOTSTRAP_INSTRUCTOR_PASSWORD_HASH`; existující účet se nepřepíše. Docker obraz obsahuje buildovací nástroje kvůli migracím a jednorázovému založení účtu; veřejný server je neobsluhuje.

## Mapa souborů

| Umístění | Účel |
|---|---|
| `src/app/` | Stránky App Routeru, globální responzivní vzhled |
| `src/components/Instructor.tsx` | Přihlášení, cvičení, prostředí, profily, scénáře, historie, reference |
| `src/components/Detector.tsx` | Aktivace, LCD, LED, C a stav spojení |
| `src/lib/domain.ts` | Typy, jednotky, ukázkový profil a 19 scénářů |
| `src/lib/engine.ts` | Alarmy, integrace expozice a rampy |
| `src/lib/audio.ts` | Přerušitelná zvuková signalizace |
| `src/lib/vibration.ts` | Opakované vibrace podle alarmu, zrušení při neaktivním detektoru |
| `src/lib/client.ts` | API, heartbeat a opětovné připojení |
| `server/` | API, autentizace, databáze a autoritativní runtime |
| `prisma/` | Databázové schéma a počáteční migrace |
| `public/` | Manifest, ikony a bezpečná offline stránka |
| `scripts/` | Založení účtu a volitelná lokální PostgreSQL |
| `tests/`, `e2e/` | Automatické testy |
| `Dockerfile`, `compose.yaml`, `railway.toml`, `.env.example` | Build, místní DB a nasazení |
| `docs/` | Zdroje, omezení a výsledky ověření |
