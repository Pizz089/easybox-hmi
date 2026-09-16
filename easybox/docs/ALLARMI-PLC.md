# Codici allarme del PLC — come si leggono

Il pannello mostra gli allarmi con la chiave i18n `robot.alarm_<codice>`. Quando
la chiave manca, a video esce la chiave grezza: succede ogni volta che il PLC
tira fuori un codice che nessuno ha ancora tradotto.

## La convenzione: MissionCode * 100 + errore

I codici lunghi NON sono numeri arbitrari. Si scompongono:

```
13599  ->  135 * 100 + 99   missione 135 (PickPlacePart_MC, comando 16)
                            errore  99   quote di lavorazione non trovate a database

3005   ->   30 * 100 + 5    catena Pallet_Robot_to_MC
                            errore   5   posizione pallet in macchina non trovata
```

Quindi davanti a un codice sconosciuto: si dividono le ultime due cifre dal
resto, il primo pezzo dice **quale missione o catena** ha fallito, il secondo
**cosa** e' andato storto dentro quella missione. Non serve indovinare, e non
si deve inventare una descrizione plausibile: si ricava, e se il pezzo di
sinistra non si riconosce si chiede al robotista.

I codici corti (944, 945, 946, 947, 948, 996, 997, 999) NON seguono questa
regola: sono errori di rifiuto delle dichiarazioni manuali, elencati sotto.

## Due namespace distinti, e non vanno mescolati

| chiave | a chi serve | dove si vede |
|---|---|---|
| `robot.alarm_<codice>` | allarmi di ciclo | toast globale (StandardMenu), card unita' |
| `robot.declErr.<codice>` | rifiuti delle dichiarazioni manuali (35/36/37/38/39) | dentro la sezione del dialog "Reimposta stato cella" |

Sono separati per necessita', non per gusto: **`robot.alarm_99` esiste gia' ed
e' "ALLARME GENERICO"**, mentre il 99 pubblicato su `FROM_PLANT/ALARM/BOX`
vuol dire "numero cassetto fuori intervallo". Stesso numero, due significati,
due canali diversi. Tenerli nello stesso namespace avrebbe fatto comparire la
frase sbagliata.

## Rifiuti delle dichiarazioni manuali

Instradati per sezione dal codice, perche' i canali `ALARM/MC1`, `ALARM/BOX` e
`ALARM/ROBOT` dicono l'unita' ma non quale comando ha rifiutato.

| codice | canale | sezione del dialog |
|---|---|---|
| 947, 948 | `ALARM/MC1` | macchina (36/37) |
| 99, 996, 997, 999 | `ALARM/BOX` | cassetto (38) |
| 944, 945, 946 | `ALARM/ROBOT` | robot (35) |
| 20001, 20002, 20005, 20006 | `ALARM/ROBOT` | tasche (39) |

Il PLC pubblica l'allarme quando rifiuta, ma **non pubblica niente per dire
"ora e' a posto"**: manda solo l'eco del comando riuscito. Per questo nel
dialog l'eco vale anche come cancellazione dell'errore di quella sezione.

## Se manca una chiave

1. si decodifica il numero con la regola qui sopra;
2. si aggiunge `robot.alarm_<codice>` in **it.json e en.json** (parita' di
   conteggio: la verifica sta in coda ai test i18n);
3. il testo sta nel registro delle chiavi vicine — una riga, il fatto, niente
   istruzioni. Le istruzioni servono ai rifiuti (`declErr`), che dicono anche
   cosa fare, non agli allarmi di ciclo.
