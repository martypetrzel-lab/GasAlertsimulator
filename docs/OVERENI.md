# Záznam ověření

Datum: 15. 10. 2026. Prostředí: Windows, Node.js 24.15.0, skutečná lokální PostgreSQL 17, Chromium prostřednictvím Playwright. Databáze není nahrazena paměťovou maketou.

| Kontrola | Výsledek |
|---|---|
| TypeScript `tsc --noEmit` | Prošlo |
| ESLint (TypeScript a React Hooks) | Prošlo bez chyb a varování |
| Jednotkové testy | 24 / 24 prošlo |
| End-to-end testy proti produkčnímu serveru | 3 / 3 prošlo (celkem přibližně 1,2 minuty) |
| Produkční build Next a vlastního serveru | Prošlo |
| Počáteční SQL migrace na PostgreSQL | Prošlo |
| Prisma validate / migrate status | Platné schéma, migrace aplikována |
| Porovnání skutečné DB se schématem | Žádný rozdíl |
| `npm audit` všech závislostí | 0 hlášených zranitelností |
| Spuštění produkčního serveru a DB healthcheck | Prošlo |
| Dva detektory v oddělených mobilních kontextech | Synchronní koncentrace, vlastní alarmová paměť |
| Výpadek a opětovné připojení | Chybový displej bez starých čísel, návrat aktuálního stavu |
| Vizuální kontrola | Úvod, instruktorský panel a detektor na PC i mobilu |
| Malý detektor 320 × 568 px | Bez vodorovného i svislého přesahu |

Jednotkové testy pokrývají oba směry alarmu O₂, LOW/HIGH, multigas, OL, závadu, baterii, potvrzení a návrat zvuku, latching, TWA/STEL, částečné okno, lineární integraci, slučování konstantních úseků, chybu expozice při vadném senzoru, vlastní historii účastníka, růst/pokles/pozastavení a zrychlení času. Validace odmítá záměnu jednotek, nevhodné meze a neplatné příkazy.

E2E kontrola v čase **1:1** prošla: instruktor vytvořil cvičení, dva oddělené mobilní kontexty aktivovaly detektory, CO rostlo z 0 na 150 ppm během skutečných 60 sekund. Instruktor během růstu opustil panel. Oba detektory zobrazily LOW, po zvýšení na 250 ppm HIGH, po výpadku jednoho spojení se znovu synchronizovaly. Reset prostředí zachoval alarmovou paměť; potvrzení jednoho hasiče nezrušilo alarm druhému. Ukončení se projevilo na obou a historie obsahovala potvrzení i spojovací události.

Samostatná bezpečnostní kontrola prošla: nepřihlášené API, neautorizovaný instruktorský socket, instruktorský příkaz detektoru a přístup jiného přihlášeného instruktora k cizímu cvičení byly odmítnuty. Snímek hasiče neobsahoval cíle, profil ani scénář. Testy používají vygenerovaný vlastní účet a vlastní cvičení, která po skončení ukončí a odstraní přes autorizované rozhraní.

Třetí E2E test ověřil nový cyklus: aktuální maximum CO se vynulovalo, ale předchozí maximum 250 ppm zůstalo archivované v události cyklu. Tím lze dohledat minulou expozici i po výslovném resetu.

## Co nebylo ověřeno v tomto prostředí

- Docker engine není spuštěn, proto nebyl sestaven a spuštěn kontejner. Dockerfile je připravený; lokálně byly samostatně ověřeny jeho aplikační kroky, migrace a produkční server.
- GitHub Actions workflow je připravené, ale dosud neběželo na GitHubu.
- Vzdálený GitHub repozitář a nasazení Railway nebyly vytvořeny: není zadaný cílový repozitář ani dostupná Railway služba. Není tvrzena veřejná funkční adresa.
- Fyzické telefony Android/iOS, skutečný zvuk, tichý režim, telefonní hovory, instalace PWA a chování konkrétních mobilních prohlížečů vyžadují terénní kontrolu. Chromium testy ověřují interakce a stav aplikace, nikoliv slyšitelnost reproduktoru.
- Nebyl proveden zátěžový test desítek až stovek zařízení, penetrační audit ani porovnání přístroje vedle skutečného GasAlertu.
- Nebyly ověřeny aktuální číselné PEL/NPK-P v e-Sbírce; referenční tabulka zůstává prázdná. Přesnost simulovaných rytmů a servisní omezení jsou uvedeny v `ZDROJE.md`.
