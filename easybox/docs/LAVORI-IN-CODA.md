# Lavori in coda — difetti noti tenuti fuori dal cantiere corrente

> Questo file NON e' una lista di desideri. Ci sta solo cio' che e' stato
> verificato nel codice, con il conteggio reale e il motivo per cui non e'
> stato corretto sul momento. Gli interventi manuali da fare in impianto
> stanno invece in `APPUNTI-CELLA.md`.

## [ ] `dataStored.userLevel<0`: vincoli di sola lettura che non bloccano niente

**Cosa.** Nei form compare `:readonly="dataStored.userLevel<0"`. Il livello
utente vale 0, 1 o 2 e non e' mai negativo, quindi l'espressione e' sempre
falsa e il campo resta sempre modificabile. Dove l'idioma e' usato per
`:disabled` su un bottone, vale lo stesso: il bottone non si disabilita mai.

**Quanto.** 44 occorrenze in tutto, ma solo 14 sono raggiungibili dal router
attivo. Le altre stanno in file morti e non vanno toccate.

| File | Occorrenze | Stato |
|---|---|---|
| `views/conf/Grating/Grating.vue` | 9 | vivo, rotta `/conf/Grating/:grating_ID` |
| `views/conf/Grating/ImportGrating.vue` | 4 | vivo, rotta `/conf/importGrating`, gia' marcato legacy |
| `views/conf/Fixture/FixtureOnPallet.vue` | 1 | vivo, rotta `/conf/FixtureOnPallet` |
| `views/conf/Grating/GratingTest.vue` | 10 | rotta RIMOSSA l'1/9, file non raggiungibile |
| `views/conf/Grating/old/Grating1.vue` | 10 | morto |
| `views/conf/Grating/old/GratingTestORIGI.vue` | 10 | morto |

**Perche' conta.** Sono i form del grigliato e dell'attrezzatura su pallet,
cioe' dati che finiscono nelle coordinate lette dal robot. Chi ha scritto quei
binding voleva un vincolo e ha creduto di averlo messo.

**Perche' NON e' una sostituzione meccanica.** Rimpiazzare `<0` con `>=1`
accenderebbe di colpo 14 vincoli veri, e da domani l'operatore di livello 0 non
potrebbe piu' modificare campi che oggi modifica tutti i giorni. La soglia va
decisa campo per campo con chi usa il pannello, non dedotta dal codice. Per
questo il lavoro e' separato: la parte tecnica e' banale, la parte che conta e'
la decisione su chi puo' toccare cosa.

**Trovato il** 2026-09-15, durante la proposta della pagina di simulazione
della spinta in battuta.
