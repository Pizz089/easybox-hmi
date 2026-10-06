# Decisioni

Decisioni di Dario che vincolano codice, dati e procedure in cella; la più recente in alto. Il come (script, comandi, ordine degli interventi) sta in [APPUNTI-CELLA.md](APPUNTI-CELLA.md).

**Work object per cassetto (6/10).** Il robot usa un work object per ogni cassetto: meccanicamente i cassetti non sono paralleli né equidistanti. Il PLC manda il numero del cassetto in N_Cassetto (%QW644) in tutte le missioni sul cassetto, e 0 nelle altre. Le quote delle tasche sono relative al cassetto (vista 4Robot v4): le correzioni del cassetto in TRAY non entrano più nelle quote del robot. Le quote di estrazione sono relative al cassetto e si ottengono conservando la differenza fra prelievo e cassetto che era corretta prima; i ritocchi si fanno a mano in tabella. Il comando "0 CASSETTIERA" è eliminato; le rotazioni si impostano cassetto per cassetto dalla scheda del cassetto.
