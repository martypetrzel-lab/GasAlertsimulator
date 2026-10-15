# Zdroje a hranice věrnosti

Datum kontroly zdrojů: **15. 10. 2026**. Kategorie se nepřevádějí jedna na druhou.

## Chování přístroje

[Česká uživatelská příručka XT / XL / X3](https://www.vyzbrojna.cz/upload/ObchodZbozi/4119/micro-clip-uzivatelske-prirucka-cz.pdf), tištěné strany 6, 11–16: ověřeno ovládání C, dvojstisk pro TWA/STEL/MAX, reset, pomalá signalizace LOW/TWA, rychlá HIGH/STEL/OL, multigas, Err, latching, potvrzení zvuku LOW pro CO/H₂S/LEL, potlačení IntelliFlash při alarmu a výchozí interval 1 s. STEL dovoluje 5–15 min. Prahy lze konfigurovat.

[Podrobnější příručka výrobce](https://www.honeywellanalytics.com/~/media/honeywell-analytics/products/gasalertmicroclip-series/documents/gasalertmicroclip_xtxlx3_user_manual_f2.pdf?la=en-gb), tištěné strany 31–33: TWA je osmihodinový klouzavý průměr, STEL interval nastavitelný; tovární nastavení se může lišit podle regionu. Aplikace nepovažuje vzorové tovární hodnoty za konfiguraci konkrétního kusu. Expozice během prvního neúplného okna používá výslovně popsanou metodu se jmenovatelem celého okna; přesná implementace firmwaru není ověřená.

[Produktový přehled X3](https://www.gasedo.cz/GasAlert-Micro-Clip-X3-detektor-plynu-d29.htm) byl prohlédnut jako doplňkový popis. Ovládání odvozujeme z příruček, nikoliv z marketingových údajů.

Ukázkový profil používá výcvikově zvolené LOW/HIGH: O₂ 19,5 / 23,5 % obj., CO 35 / 200 ppm, H₂S 10 / 15 ppm, LEL 10 / 20 % LEL; TWA/STEL CO 35 / 50 ppm, H₂S 10 / 15 ppm. Každý práh nese jednotku, zdroj „Ukázková výcviková volba“ a nevyplněné datum ověření. Není vydáván za oficiální český profil. Uložený vlastní profil má stejná metadata pro každý práh.

Rozsahy 0–500 ppm CO, 0–100 ppm H₂S, 0–30 % obj. O₂ a 0–100 % LEL odpovídají výslovnému zadání simulace. OL se zobrazuje nad rozsahem. % LEL se nepřevádí na objem plynu.

## Hygiena práce

[Nařízení vlády č. 361/2007 Sb. v e-Sbírce](https://e-sbirka.gov.cz/sb/2007/361) při automatickém čtení nevrátilo text aktuální tabulky. Proto není vložena žádná domnělá hodnota PEL/NPK-P. Samostatný verzovaný model a formulář vyžadují zdroj, datum ověření a jednotku mg/m³. Ručně vložené údaje jsou tvrzením vkládajícího instruktora; samotné datum nezaručuje právní správnost. Tyto údaje nejsou vstupem alarmového enginu.

## Taktika HZS

[Souhrn metodických předpisů](https://www.hasici-vzdelavani.cz/content/souhrn-metodickych-predpisu) je uveden v referenční části pro instruktora. Simulátor nepřepisuje taktické postupy ani nehodnotí reakce hasičů. Scénáře jsou uměle zvolené výcvikové průběhy, nikoliv výpočty skutečných havárií.

## Aproximace a nezahrnuté funkce

Kreslené průmyslové tělo a LCD jsou vlastní CSS, bez loga a převzatých grafických aktiv. Jsou inspirované přístrojem, nejde o přesnou kopii rozměrů a segmentů. Číslice se obnovují přibližně každou sekundu. Vibrace používají výcvikové rytmy přes Vibration API, bez tvrzení o přesném rytmu originálu; podpora závisí na prohlížeči, motoru a nastavení telefonu.

Akustické frekvence, rychlé/pomalé rytmy, střídání multigas, doba podsvícení, délka podržení C a časy sekvence displejů jsou výcvikové aproximace. Nízká baterie má zjednodušenou signalizaci, neimplementuje celou 15minutovou a vypínací sekvenci. Prah 10 % je zvolen pro výcvik. Závada senzoru trvá do odvolání instruktorem; kompletní servisní režimy, kalibrace, nárazové testy, skutečná odezva senzorů a nelinearita nejsou simulovány. U O₂ se ukládá minimum i maximum, obrazovka MAX zobrazuje maximum; minimum je v exportu.

Nejsou tvrzeny neověřené přesné frekvence originální sirény ani právní platnost výcvikových hodnot. Před výcvikem s konkrétním zařízením instruktor musí profil porovnat s jeho skutečným nastavením.
