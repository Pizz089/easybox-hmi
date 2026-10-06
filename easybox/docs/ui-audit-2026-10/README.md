# Audit estetico del pannello, ottobre 2026

Confronto del pannello EasyBox con i touchscreen Bambu Lab (X1 e H2D) e piano del restyling a fasi: analisi in `REPORT.md` (5/10/2026), tre mockup HTML in `mockup/` da aprire con doppio click. Le regole in vigore stanno in `../UI-DESIGN-SYSTEM.md` (dal 6/10 la v3, tavole in `../ui-v3/`).
Mancano di proposito le 83 schermate di cella e le immagini Bambu: queste ultime sono di Bambu Lab, le fonti ufficiali sono [Screen Operation X1](https://wiki.bambulab.com/en/x1/manual/screen-operation), [Screen Operation H2D](https://wiki.bambulab.com/en/h2/manual/screen-operation), [HMS](https://wiki.bambulab.com/en/x1/troubleshooting/intro-hms), [Skipping objects](https://wiki.bambulab.com/en/general/skipping-objects), [schermo X1](https://wiki.bambulab.com/en/x1/maintenance/replace-high-resolution-screen), [specifiche H2D](https://bambulab.com/en/h2d/tech-specs).

| # | Decisione di Dario (REPORT §4.6) |
|---|---|
| 1 | B: struttura Bambu con i colori di oggi: palette e accento blu invariati, niente lime |
| 2 | A: pulsanti a rettangolo arrotondato, `--radius-btn` 14px ("AZIONE = rettangolo arrotondato pieno") |
| 3 | A: striscia di stato in alto, nella fase 2 |
| 4 | A: colori delle tasche fissati una volta (`--pocket-*`, doc §11), via l'inversione RAW/WORKING |
| 5 | A: pagina Allarmi (HMS) come fase a sé, dopo le fondamenta |

I mockup usano l'accento lime, scartato dalla decisione 1: di loro conta la struttura, non il colore.
