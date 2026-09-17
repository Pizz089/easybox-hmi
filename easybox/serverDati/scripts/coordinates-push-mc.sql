-- ===========================================================================
-- coordinates-push-mc.sql — vista COORDINATES_PUSH_MC (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9; compensazione semilavorati 17/9)
--
-- *** NASCE IN CHIARO, DEFINIZIONE VERSIONATA QUI. ***
-- Le viste 4Robot e WORKORDERS erano CIFRATE e questo e' costato ore quando
-- si e' dovuto capire perche' PRODUCTED restava a zero. Nessuna vista nuova
-- di questo progetto sara' mai WITH ENCRYPTION.
--
-- STATO: in cella (2026-09-17) c'e' gia' una versione con COMP_PUSH e, dopo
-- una correzione a mano, col segno giusto — ma SENZA il ramo NO_COMP. Questo
-- script lo aggiunge. Le guardie qui sotto distinguono quattro varianti
-- (segno giusto CON NO_COMP -> esce; segno giusto senza -> aggiunge; segno
-- sbagliato -> corregge; nessuna compensazione -> applica).
-- Non e' un no-op: va lanciato.
--
-- RISCONTRO, ordine 1104, pezzo 1034 (Y 100000), ganascia morsa 107200,
-- chela pinza 42000, deposito 311000, COMP_PUSH 300:
--   X_PUSH    = 311000 - 50000 - 21000 = 240000
--   CLEARANCE = (107200 - 100000)/2    = 3600
--   X_STOP    = 240000 + 3600 - 300    = 243300   (corsa effettiva 3300)
-- Con il segno sbagliato usciva 243900: 600 micron oltre il punto voluto.
--
-- SCOPO: il PLC legge UNA riga e ha tutto. Il calcolo delle tre quote sta
-- qui, non nel PLC: e' verificabile con un test e il PLC resta semplice.
--
-- LE TRE QUOTE (asse di battuta = X del ROBOT, quella che il PLC manda come
-- X_Pick-Place; NON l'asse della macchina utensile):
--   deposito = P.X                                        (invariata)
--   spinta   = P.X - pezzo.Y/2 - lunghezza_ganascia_pinza/2
--   arrivo   = spinta + corsa - compensazione
-- Durante la spinta Y e Z restano quelle del deposito: si muove solo la X.
--
-- LA CORSA HA DUE CASI (chiarito da Dario 15/9). Un pezzo PIU' LUNGO della
-- ganascia non e' un errore: e' legittimo e succede. In quel caso non appoggia
-- sulla fine della ganascia ma piu' avanti, su un altro riferimento fisico,
-- e quella distanza va DICHIARATA in PIECE_ON_VICE.STOP_BEYOND_CLAW.
--
--   corsa = (ganascia - pezzo)/2               se pezzo <= ganascia -> 'CLAW'
--   corsa = (ganascia - pezzo)/2 + dichiarata  se pezzo >  ganascia -> 'DECLARED'
--
-- COMPENSAZIONE SPINTA (PIECE_ON_VICE.COMP_PUSH, micron, NULL = nessuna).
-- Serve ai SEMILAVORATI, che non devono arrivare in battuta come il grezzo:
-- dice di quanto il pezzo si deve fermare PRIMA della battuta teorica, quindi
-- e' SEMPRE POSITIVO e SI SOTTRAE. La corsa effettiva risulta MINORE di
-- CLEARANCE.
--
-- E' uno scostamento fine sulla SOLA QUOTA DI ARRIVO: X_PUSH e CLEARANCE
-- restano il valore geometrico TEORICO, cosi' la compensazione resta
-- LEGGIBILE come differenza fra le colonne —
--
--   (X_PUSH + CLEARANCE) - X_STOP = COMP_PUSH
--
-- — e si distingue a colpo d'occhio cosa viene dal modello e cosa dalla
-- taratura.
--
-- NO_ROOM resta un fatto di GEOMETRIA (corsa teorica negativa: la spinta
-- andrebbe all'indietro) e la compensazione non lo produce.
--
-- MA UNA COMPENSAZIONE PIU' GRANDE DELLA CORSA HA IL SUO ESITO: 'NO_COMP'.
-- L'arrivo finirebbe DIETRO la partenza e il robot spingerebbe nel VERSO
-- OPPOSTO contro il pezzo gia' in morsa. Non basta che il numero si veda in
-- X_STOP: in cella non c'e' niente che lo fermi — il controllo di
-- plausibilita' del 36 e del 1412 in FB7 guarda la DISTANZA da X_PLACE
-- (500 mm), non il VERSO, quindi 3300 e -300 gli passano uguale. Con
-- PUSH_STATUS diverso da OK le quote escono NULL, FB7 le scarta come gia' fa
-- e la spinta non parte: meglio nessuna spinta che una spinta rovesciata.
--
-- ISNULL OBBLIGATORIO sulla colonna: e' NULL sui pezzi non tarati (il 1033 lo
-- e' adesso) e il ponte SQL del backend NON converte NULL in zero, restituisce
-- valori casuali. Qui NULL e 0 coincidono per definizione — non compensare e
-- compensare di zero sono la stessa cosa — quindi l'ISNULL non perde
-- informazione. E' l'opposto di STOP_BEYOND_CLAW, dove l'assenza della riga
-- SIGNIFICA "non dichiarato" ed e' NO_FIT.
--
-- Stessa chiave di STOP_BEYOND_CLAW: la compensazione segue la MORSA, non il
-- pallet.
--
-- Quando il pezzo sta DENTRO la ganascia il valore dichiarato viene ignorato,
-- perche' la fine della ganascia arriva prima e il pezzo si ferma li'. E' una
-- regola del modello, allo stesso titolo del deposito centrato qui sotto.
--
-- La quota di SPINTA non cambia nei due casi: la chela tocca il bordo vicino
-- del pezzo, e dove sta quel bordo non dipende dalla ganascia.
--
-- PERCHE' pezzo.Y SULLA X: fra disegno e robot c'e' una rotazione. Nel
-- cassetto il passo lungo la X del robot vale PIECE.Y + SAFEY (convenzione
-- validata sul ferro, util/gratingAxes.js), quindi e' PIECE.Y a correre lungo
-- la X; il pezzo non ruota fra presa e deposito, percio' in morsa presenta la
-- stessa dimensione. Riscontro pezzo 1029 (PIECE.X 40, PIECE.Y 120): nel
-- cassetto occupa 120 sulla X del robot e 40 sulla Y.
--
-- Sulla spinta si compensa MEZZA LUNGHEZZA di chela: il TCP sta al centro
-- della chela e il punto che tocca il pezzo e' il bordo. Le chele della pinza
-- e le ganasce della morsa si aprono entrambe lungo la Y, cioe' stringono di
-- traverso rispetto alla spinta: la chela presenta quindi la sua LUNGHEZZA
-- nella direzione in cui spinge, e la ganascia della morsa CONTIENE il pezzo
-- nella direzione in cui scorre fino alla battuta.
--
-- IPOTESI DICHIARATA (confermata da Dario 15/9): il deposito e' SEMPRE
-- CENTRATO sulla morsa, quindi lo spazio verso la battuta e' meta' della
-- differenza fra ganascia e pezzo. Se un domani si riapprende la posizione
-- di deposito SCENTRATA, questa formula sbaglia in silenzio: la dipendenza
-- e' annotata in APPUNTI-CELLA.
--
-- DEPOSITO BYTE-IDENTICO ALLA QUERY CHE IL PLC USA OGGI:
--   select P.X, P.Y, P.Z + C.Z_PLACE + F.Z from POSITION P, WORKORDER W,
--          PIECE C, FIXTURE F
--    where C.ID=W.PIECE_ID and F.ID=W.FIXTURE_ID and P.PARENT='MC_1'
-- cosi' la spinta parte esattamente dalla base del deposito.
-- NB: quella query non filtra W (giunzione cartesiana su tutti gli ordini):
-- la vista espone ORDER_ID proprio perche' la selezione sia esplicita, e
-- lega la posizione alla macchina dell'ordine (PARENT = 'MC_' + MACHINE_ID).
--
-- COLONNE DI ESITO — il PLC legge PUSH_STATUS PRIMA delle quote:
--   'DISABLED' bit di spinta non attivo sull'ordine  -> X_PUSH/X_STOP NULL
--   'NO_VICE'  nessuna morsa sul pallet dell'ordine  -> NULL
--   'NO_DATA'  manca la ganascia della morsa o la lunghezza della chela -> NULL
--   'NO_FIT'   pezzo oltre la ganascia E appoggio NON dichiarato -> NULL
--   'NO_ROOM'  la corsa GEOMETRICA verrebbe NEGATIVA, cioe' la spinta
--              andrebbe all'indietro -> NULL. Ci si arriva in un modo solo:
--              appoggio dichiarato piu' vicino di quanto il pezzo gia'
--              sporge, cioe' al deposito sarebbe GIA' oltre la battuta
--   'NO_COMP'  la compensazione supera la corsa: l'arrivo finirebbe dietro la
--              partenza e la spinta si rovescerebbe -> NULL
--   'OK'       quote valorizzate (corsa zero compresa: pezzo gia' a contatto)
-- X_PUSH/X_STOP sono NULL quando non sono utilizzabili: un PLC che leggesse
-- le quote ignorando l'esito fallisce la lettura invece di muoversi male.
--
-- STOP_REF dice SU COSA appoggia il pezzo: 'CLAW' fine della ganascia,
-- 'DECLARED' riferimento dichiarato oltre di essa. E' valorizzata anche su
-- NO_FIT, NO_ROOM e NO_COMP, perche' li' la geometria il riferimento lo
-- implica gia': serve al pannello per spiegare all'operatore cosa manca.
--
-- DIVISIONI INTERE: le colonne sono int, quindi /2 tronca (1 micron). Con il
-- pezzo oltre la ganascia la differenza e' NEGATIVA e SQL Server tronca verso
-- lo ZERO, esattamente come Math.trunc: il pannello replica lo stesso
-- troncamento (util pushQuotes, test di parita' con un caso dispari negativo).
--
-- IDEMPOTENTE, e NON SOVRASCRIVE ALLA CIECA: se in cella trova una
-- definizione che non e' ne' la precedente attesa ne' questa, si FERMA. La
-- lezione e' della vista WORKORDERS (vedi APPUNTI-CELLA): gli script del repo
-- non sono la fonte di verita', lo e' sys.sql_modules.
--
-- ORDINE DI DEPLOY: DOPO piece-push-to-stop.sql, vice-claw-length.sql,
-- gripper-claw-length.sql e piece-on-vice.sql (li nomina tutti), piu' la
-- colonna PIECE_ON_VICE.COMP_PUSH (int NULL, micron), a cella ferma con -E.
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-push-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.PIECE', 'PUSH_TO_STOP') IS NULL
   OR COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NULL
   OR COL_LENGTH('dbo.GRIPPER', 'CLAW_LENGTH') IS NULL
   OR OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
   OR COL_LENGTH('dbo.PIECE_ON_VICE', 'COMP_PUSH') IS NULL
BEGIN
	PRINT 'MANCANO colonne o tabelle: eseguire prima piece-push-to-stop.sql, vice-claw-length.sql, gripper-claw-length.sql, piece-on-vice.sql e la colonna PIECE_ON_VICE.COMP_PUSH (int NULL, micron).';
	SET NOEXEC ON;
END
GO

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PUSH_MC'));

-- confronto a spazi normalizzati: a capo, tabulazioni e spazi multipli
-- diventano un singolo spazio, cosi' le guardie non dipendono da come la
-- definizione e' stata formattata
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');

-- QUATTRO VARIANTI POSSIBILI, e vanno distinte tutte.
--
-- La compensazione e' arrivata in cella in due riprese e sbagliando due volte:
-- prima col SEGNO invertito (somma invece di sottrazione), poi col segno
-- giusto ma SENZA il ramo NO_COMP. Una guardia che si accontenti di vedere il
-- meno uscirebbe dicendo "c'e' gia" e lascerebbe la vista senza l'esito che
-- impedisce la spinta rovesciata — cioe' proprio il caso che si sta chiudendo.
-- Per questo il ramo "esci" chiede DUE cose: il segno giusto E il NO_COMP.
IF @def IS NULL
	PRINT 'coordinates-push-mc: la vista non esiste, la creo.';
ELSE IF @norm LIKE N'%q.X_PUSH_RAW + q.TRAVEL_RAW - q.COMP_PUSH end as X_STOP%'
	 AND @norm LIKE N'%then ''NO_COMP''%'
BEGIN
	PRINT 'coordinates-push-mc: segno giusto e ramo NO_COMP gia'' presenti, nessuna modifica.';
	SET NOEXEC ON;
END
ELSE IF @norm LIKE N'%q.X_PUSH_RAW + q.TRAVEL_RAW - q.COMP_PUSH end as X_STOP%'
	PRINT 'coordinates-push-mc: segno giusto ma MANCA il ramo NO_COMP: lo aggiungo.';
ELSE IF @norm LIKE N'%q.X_PUSH_RAW + q.TRAVEL_RAW + q.COMP_PUSH end as X_STOP%'
	PRINT 'coordinates-push-mc: trovata la variante col PIU'' (arrivo oltre la battuta): la correggo.';
ELSE IF @norm LIKE N'%then q.X_PUSH_RAW + q.TRAVEL_RAW end as X_STOP%'
	PRINT 'coordinates-push-mc: versione senza compensazione, la aggiungo.';
-- nessuna delle quattro: la vista in cella e' qualcosa che non conosco
ELSE
BEGIN
	PRINT 'coordinates-push-mc: la vista in cella non e'' nessuna delle varianti note. FERMO.';
	PRINT 'Leggerla con: SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(''dbo.COORDINATES_PUSH_MC'');';
	PRINT 'e riconciliare a mano: il testo qui sotto sovrascriverebbe modifiche che non conosco.';
	SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.COORDINATES_PUSH_MC') IS NULL
	EXEC('CREATE VIEW dbo.COORDINATES_PUSH_MC AS SELECT 1 AS segnaposto');
GO

ALTER VIEW dbo.COORDINATES_PUSH_MC AS
select	q.ORDER_ID,
		q.MC,
		q.X_PLACE,
		q.Y_PLACE,
		q.Z_PLACE,
		-- X_PUSH e CLEARANCE: geometria pura, senza compensazione.
		-- X_STOP: la sola quota tarata, e la compensazione si SOTTRAE — il
		-- pezzo si ferma prima della battuta teorica. La differenza fra le tre
		-- e' il valore di COMP_PUSH, ed e' voluto che si veda.
		case when q.PUSH_STATUS = 'OK' then q.X_PUSH_RAW end				as X_PUSH,
		case when q.PUSH_STATUS = 'OK' then q.X_PUSH_RAW + q.TRAVEL_RAW - q.COMP_PUSH end	as X_STOP,
		case when q.PUSH_STATUS = 'OK' then q.TRAVEL_RAW end				as CLEARANCE,
		q.STOP_REF,
		q.STOP_BEYOND_CLAW,
		q.COMP_PUSH,
		q.PUSH_ENABLED,
		q.PUSH_STATUS
from (
	select	w.ID													as ORDER_ID,
			w.MACHINE_ID											as MC,
			p.X														as X_PLACE,
			p.Y														as Y_PLACE,
			p.Z + pz.Z_PLACE + f.Z									as Z_PLACE,
			p.X - pz.Y/2 - g.CLAW_LENGTH/2							as X_PUSH_RAW,
			-- corsa TEORICA: fino alla fine della ganascia, piu' il tratto
			-- dichiarato SOLO quando il pezzo la eccede. La compensazione non
			-- entra qui: si toglie dall'arrivo, non da questo numero
			(v.CLAW_LENGTH - pz.Y)/2
				+ case when pz.Y > v.CLAW_LENGTH
					   then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end	as TRAVEL_RAW,
			pv.STOP_BEYOND_CLAW										as STOP_BEYOND_CLAW,
			-- ISNULL obbligatorio: NULL sui pezzi non tarati, e il ponte SQL
			-- non lo converte in zero (restituisce valori casuali)
			ISNULL(pv.COMP_PUSH, 0)									as COMP_PUSH,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then null
				 when v.ID is null									then null
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then null
				 when pz.Y > v.CLAW_LENGTH							then 'DECLARED'
				 else 'CLAW' end									as STOP_REF,
			case when (ISNULL(w.OPTION2,0) & 2) <> 0 then 1 else 0 end		as PUSH_ENABLED,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then 'DISABLED'
				 when v.ID is null									then 'NO_VICE'
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then 'NO_DATA'
				 when pz.Y > v.CLAW_LENGTH
				  and pv.VICE_ID is null							then 'NO_FIT'
				 when (v.CLAW_LENGTH - pz.Y)/2
					  + case when pz.Y > v.CLAW_LENGTH
							 then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end < 0
																	then 'NO_ROOM'
				 -- la compensazione supera la corsa: l'arrivo finirebbe dietro
				 -- la partenza e il robot spingerebbe nel verso opposto
				 when (v.CLAW_LENGTH - pz.Y)/2
					  + case when pz.Y > v.CLAW_LENGTH
							 then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end
					  - ISNULL(pv.COMP_PUSH, 0) < 0
																	then 'NO_COMP'
				 else 'OK' end										as PUSH_STATUS
	from WORKORDER w
	inner join [POSITION] p	on RTRIM(p.PARENT) = CONCAT('MC_', w.MACHINE_ID)
	inner join PIECE pz		on pz.ID = w.PIECE_ID
	inner join FIXTURE f	on f.ID = w.FIXTURE_ID
	left  join VICE v		on v.PALLET_ID = w.PALLET_ID
	left  join GRIPPER g	on g.ID = w.GRIPPER_ID
	-- la dichiarazione segue la MORSA (v.ID), non il pallet: se la morsa si
	-- sposta su un altro pallet si porta dietro la sua battuta
	left  join PIECE_ON_VICE pv	on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID
) q;
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA
--
-- RISCONTRO DI CAMPO (2026-09-17, ordine 1104, pezzo 1034, COMP_PUSH = 300):
--   X_PUSH 240000   CLEARANCE 3600   X_STOP 243300   (corsa effettiva 3300)
--   (X_PUSH + CLEARANCE) - X_STOP = 300 = COMP_PUSH
--
-- Gli esempi qui sotto usano un pezzo NON QUADRATO (col 1033, 100.6x100.6,
-- un errore d'asse non si vedrebbe).
--
-- Pezzo DENTRO la ganascia — 1029: PIECE.X 40000, PIECE.Y 120000; chela pinza
-- 30000; ganascia morsa 150000:
--   X_PUSH    = X_PLACE - 60000 - 15000
--   CLEARANCE = (150000 - 120000)/2 = 15000       STOP_REF = 'CLAW'
--   X_STOP    = X_PUSH + 15000 - COMP_PUSH
--
-- Pezzo OLTRE la ganascia — 180000 lungo la spinta, stessa ganascia: sporge
-- 15000 per lato. Con appoggio dichiarato a 25000 oltre la fine ganascia:
--   CLEARANCE = (150000 - 180000)/2 + 25000 = 10000   STOP_REF = 'DECLARED'
-- con appoggio dichiarato a 10000: CLEARANCE = -5000 -> PUSH_STATUS 'NO_ROOM'
-- senza riga in PIECE_ON_VICE:                        -> PUSH_STATUS 'NO_FIT'
--
-- COMPENSAZIONE (semilavorato) — 1029 dentro la ganascia, corsa 15000:
--   COMP_PUSH NULL o 0 -> COMP_PUSH 0, X_STOP = X_PUSH + 15000
--   COMP_PUSH   300    -> X_STOP = X_PUSH + 14700   (corsa effettiva 14700)
--   COMP_PUSH  5000    -> X_STOP = X_PUSH + 10000
--   COMP_PUSH 15001    -> PUSH_STATUS 'NO_COMP', tutte le quote NULL
-- Fino a 15000 X_PUSH e CLEARANCE non cambiano e l'esito resta OK. Oltre, la
-- spinta si rovescerebbe e l'esito diventa NO_COMP: non e' NO_ROOM, che
-- resta il caso geometrico.
--
-- SELECT ORDER_ID, MC, X_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF,
--        STOP_BEYOND_CLAW, COMP_PUSH, PUSH_ENABLED, PUSH_STATUS
--   FROM COORDINATES_PUSH_MC ORDER BY ORDER_ID;
--
-- Controprova su tutti gli ordini spinta: la compensazione deve essere
-- esattamente la differenza, e mai NULL.
--   SELECT ORDER_ID, (X_PUSH + CLEARANCE) - X_STOP AS delta, COMP_PUSH
--     FROM COORDINATES_PUSH_MC
--    WHERE PUSH_STATUS = 'OK' AND (X_PUSH + CLEARANCE) - X_STOP <> COMP_PUSH;
--   Atteso: nessuna riga.
--
-- E nessun ordine OK puo' avere l'arrivo dietro la partenza:
--   SELECT ORDER_ID, X_PUSH, X_STOP, CLEARANCE, COMP_PUSH
--     FROM COORDINATES_PUSH_MC WHERE PUSH_STATUS = 'OK' AND X_STOP < X_PUSH;
--   Atteso: nessuna riga. Se ne esce una, quelle righe dovevano dare NO_COMP.
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK alla versione senza compensazione: rilanciare lo stesso ALTER VIEW
-- qui sopra con
--   X_STOP:     q.X_PUSH_RAW + q.TRAVEL_RAW - q.COMP_PUSH  ->  q.X_PUSH_RAW + q.TRAVEL_RAW
--   subquery:   ISNULL(pv.COMP_PUSH, 0) as COMP_PUSH       ->  pv.COMP_PUSH as COMP_PUSH
-- Sono le uniche due differenze. Per togliere la vista del tutto:
--   DROP VIEW dbo.COORDINATES_PUSH_MC;
-- ===========================================================================
