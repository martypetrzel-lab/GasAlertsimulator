# Výcvikové scénáře

Knihovna obsahuje **19 upravitelných přednastavení**. Všechny koncentrace jsou uměle zvolené pro odbornou přípravu. Názvy nejsou fyzikálními modely konkrétních havárií, právními limity ani doporučením správné taktické reakce. Tu vyhodnocuje instruktor.

Při použití scénáře se mění prostředí pro všechny detektory. Změna začíná z právě aktuálních koncentrací a postupuje lineárně po zadanou dobu. Po dosažení cíle se hodnoty udržují až do dalšího příkazu. Použití scénáře nemaže expozici.

| Scénář | Cílové simulované hodnoty | Náběh |
|---|---|---|
| Čisté prostředí | O₂ 20,9 %, ostatní 0 | Okamžitě |
| CO v kotelně | CO 250 ppm | 120 s |
| Nedostatek kyslíku | O₂ 17 % obj. | 90 s |
| Únik hořlavého plynu | 35 % LEL | 90 s |
| Únik H₂S | H₂S 25 ppm | 90 s |
| Kombinované nebezpečí | O₂ 18 %, CO 250 ppm, H₂S 20 ppm, 30 % LEL | 120 s |
| Porucha senzoru | Err kanálu CO | Okamžitě |
| CO v podzemní garáži | CO 220 ppm | 120 s |
| Agregát v uzavřeném prostoru | CO 350 ppm, O₂ 19 % | 180 s |
| Prostor obohacený kyslíkem | O₂ 25 % obj. | 45 s |
| Nebezpečná atmosféra v šachtě | O₂ 16 %, H₂S 30 ppm | 60 s |
| Atmosféra v prostoru ČOV | H₂S 18 ppm, 18 % LEL | 90 s |
| Pomalý únik hořlavého plynu | 15 % LEL | 300 s |
| Rychlý únik hořlavého plynu | 60 % LEL | 30 s |
| Simulované odvětrání | Z aktuálních hodnot k O₂ 20,9 % a ostatním 0 | 120 s |
| Dlouhodobá expozice CO – STEL a TWA | CO 80 ppm, poté dále držet | Náběh 30 s |
| Překročení rozsahu CO | CO 650 ppm, nad 500 ppm zobrazení OL | 30 s |
| Překročení rozsahu H₂S | H₂S 130 ppm, nad 100 ppm zobrazení OL | 30 s |
| Porucha senzoru hořlavých plynů | Err kanálu LEL | Okamžitě |

Neuvedené plyny mají cílové výchozí hodnoty O₂ 20,9 % a CO/H₂S/LEL 0. Scénář poruchy zapne uvedenou závadu okamžitě; závady jsou součástí každého přednastavení. Použití jiného scénáře bez závad je vypne.

V knihovně lze hledat podle názvu a popisu i bez diakritiky, například `garaz` nebo `odvetrani`. Vybrané přednastavení lze upravit a uložit jako vlastní verzi. Instruktor může postupně použít například růst CO → simulované odvětrání → opětovný růst; nejde o automatický vícekrokový scénář.

U dlouhodobé expozice není délka náběhu zároveň délkou celého cvičení. Pro vznik STEL a TWA je nutné ponechat koncentraci působit po odpovídající simulační dobu. Zrychlení času zůstává výslovnou volbou instruktora a na detektoru se nemění v reálné měření.
