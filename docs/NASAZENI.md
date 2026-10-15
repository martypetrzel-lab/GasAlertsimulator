# Produkční nasazení

Datum nasazení: **15. 10. 2026**.

- Aplikace: https://gasalertsimulator-production.up.railway.app
- Instruktor: https://gasalertsimulator-production.up.railway.app/instruktor
- Připojení hasiče: https://gasalertsimulator-production.up.railway.app/detektor
- GitHub: https://github.com/martypetrzel-lab/GasAlertsimulator
- Railway projekt: https://railway.com/project/c85e06c5-1892-4f47-b365-a086f0ced76e
- Ověřený Docker build a E2E v GitHub Actions: https://github.com/martypetrzel-lab/GasAlertsimulator/actions/runs/38727597085

## Konfigurace

Railway projekt **GasAlert Simulator**, prostředí **production**, obsahuje samostatnou službu aplikace **GasAlertsimulator** a **Postgres** s trvalým diskem. Obě služby běží v regionu `us-west2`; aplikace má jednu repliku. PostgreSQL je připojena privátní sítí prostřednictvím reference `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Web je veřejný přes HTTPS na portu 3000 a trvalá spojení používají stejnou doménu přes WSS.

`APP_ORIGIN` odpovídá veřejné HTTPS adrese. `NODE_ENV=production`, uspávání aplikace je vypnuté, healthcheck `/api/health` kontroluje i dostupnost databáze. Migrace se provádějí automaticky před startem kontejneru. Zdroj sleduje větev `main`; změny aplikačních souborů a buildu vyvolají nové nasazení. Samotné úpravy dokumentace se nemusí znovu nasazovat.

Aktualizace aplikace provádějte mimo probíhající cvičení. Restart přeruší spojení a rozpracované cvičení přejde bezpečně do pozastavení; instruktor musí pokračování vědomě potvrdit. Aplikace není určena k více současným replikám.

## Přihlášení instruktora

Produkční účet má náhodné heslo odlišné od místního účtu. Přístup je uložen pouze na počítači zadavatele v ignorovaném souboru `.local/RAILWAY-PRISTUP.txt`. Heslo ani soubor nejsou součástí repozitáře, tohoto dokumentu ani veřejného webu. V databázi je pouze scrypt hash.

První účet byl založen při startu přes `BOOTSTRAP_INSTRUCTOR_EMAIL` a `BOOTSTRAP_INSTRUCTOR_PASSWORD_HASH`. Tento postup existující účet ani jeho heslo nepřepíše. Po ověření přístupu byly obě proměnné vyprázdněny pro další nasazení; účet zůstává v databázi. Další účty lze založit správcovským příkazem popsaným v README, ne veřejnou registrací.

## Ověření a údržba

GitHub Actions nyní skutečně sestavuje Docker obraz, spouští jej se skutečnou PostgreSQL a provádí E2E testy. Podrobné výsledky včetně ověření přes veřejnou doménu jsou v [OVERENI.md](OVERENI.md).

Správce má kontrolovat dostupnost Railway služby, kapacitu databázového disku a zálohy. Veřejný web nemění mobilní omezení zvuku nebo chování při zamčení telefonu; zařízení je při výcviku nutné ponechat odemčené a aplikaci v popředí.
