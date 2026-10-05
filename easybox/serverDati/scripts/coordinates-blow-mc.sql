-- ===========================================================================
-- coordinates-blow-mc.sql — vista COORDINATES_BLOW_MC (SOFFIAGGIO, 18/9;
-- dati pezzo al robot, 5/10)
--
-- *** NASCE IN CHIARO, DEFINIZIONE VERSIONATA QUI. ***
-- Come COORDINATES_PUSH_MC, e per lo stesso motivo: le viste 4Robot e
-- WORKORDERS erano CIFRATE ed e' costato ore capire perche' PRODUCTED restava
-- a zero. Nessuna vista nuova di questo progetto sara' mai WITH ENCRYPTION.
--
-- SCOPO: prima di soffiare — sia in DEPOSITO sia in PRELIEVO — il robot deve
-- sapere quanto sono lunghe le chele della morsa e com'e' fatto il pezzo. Il
-- PLC legge questa riga (FB_Robot: Part_Robot_to_MC 37-39, Part_MC_to_Robot
-- 37-39, scambio 1416-1418) e passa i numeri su variabili PROFINET, in mm
-- interi troncati, mai azzerate.
--
-- MAPPA PROFINET DELLE MISURE (Robot_Efort):
--   %QW634  Vice_ClawLength_mm  = CLAW_LENGTH
--   %QW636  Part_Width_mm       = PART_WIDTH   (PIECE.Y)
--   %QW638  X_Support_mm        = CLAW_LENGTH/2 + STOP_BEYOND_CLAW
--   %QW640  Part_Length_mm      = PART_LENGTH  (PIECE.X)   (5/10, ex spare_4)
--   %QW642  Part_Height_mm      = PART_HEIGHT  (PIECE.Z)   (5/10, ex spare_5)
--   libere da %QW644 a %QW666.
--
-- SEMANTICA DELLE MISURE DEL PEZZO (decisa da Dario e dal robotista il 5/10):
-- PIECE.X = lunghezza, PIECE.Y = larghezza, PIECE.Z = altezza, come le
-- etichette L/W/H della pagina Pezzo.
--
-- STORIA: dal 18/9 al 5/10 PART_WIDTH era pz.X, cioe' la LUNGHEZZA, e su
-- %QW636 andava quella. La nota P8 del 5/10 l'aveva "confermata" come
-- larghezza perche' aveva confrontato la definizione della vista, non il
-- pezzo. Corretta in cella il 5/10 alle 19:17 con un ALTER VIEW guardato;
-- il backup della definizione precedente sta sul PC di cella in
-- D:\Backup\COORDINATES_BLOW_MC_20261005.txt. Lezione: un nome di colonna o
-- di tag non prova il significato, si confronta col pezzo (VERIFICA 2).
--
-- PERCHE' UNA VISTA E NON UNA QUERY DIRETTA. Con i join scritti a mano la
-- query (a tre colonne) misurava 298 caratteri contro i 254 di queryTemp nel
-- PLC: sarebbe arrivata TRONCATA, cioe' lo stesso difetto dell'allarme 13599
-- del 15/9, che non da' errore ma dati sbagliati. Con la vista la query del
-- PLC a cinque colonne sta in 116 caratteri (ORDER_ID a 5 cifre). La
-- lunghezza qui e' un vincolo di correttezza, non di stile: chiunque
-- aggiunga colonne tenga il SELECT del PLC sotto i 254.
--
-- ISNULL SU TUTTE LE COLONNE, obbligatorio. Le sorgenti della morsa sono
-- opzionali (morsa non montata, chele non misurate, nessuna dichiarazione di
-- appoggio) e il ponte SQL verso il PLC NON converte NULL in zero:
-- restituisce valori CASUALI. Uno zero e' leggibile e riconoscibile come
-- "dato assente"; un numero casuale finisce in una quota.
--
-- IL JOIN SU PIECE_ON_VICE SEGUE LA MORSA (v.ID), non il pallet — identico a
-- COORDINATES_PUSH_MC: se la morsa si sposta su un altro pallet si porta
-- dietro la sua battuta. Con la chiave sul pallet la dichiarazione resterebbe
-- attaccata al posto e verrebbe applicata in silenzio alla morsa successiva.
--
-- PIECE in INNER JOIN, VICE in LEFT: un ordine ha sempre un pezzo, ma la morsa
-- puo' non esserci. Con PIECE in LEFT si nasconderebbe un dato mancante dietro
-- uno zero; con VICE in INNER l'ordine SPARIREBBE dalla vista e il PLC non
-- leggerebbe niente invece di leggere zero.
--
-- RISCONTRO DI CAMPO (5/10): ordine 2117, pezzo 1035, PIECE X 40000,
-- Y 109900, Z 15000 -> PART_LENGTH 40000, PART_WIDTH 109900, PART_HEIGHT
-- 15000; al robot 40 / 109 / 15 mm. (Il riscontro del 18/9 sull'ordine 1105,
-- PART_WIDTH 100000, era sulla definizione vecchia: quel numero era pz.X.)
--
-- STATO: la vista e' in cella dal 18/9 e dal 5/10 19:17 ha la definizione
-- qui sotto. In cella questo script e' un NO-OP e la guardia lo dice:
--   - definizione nuova (cinque colonne)          -> "conforme", niente;
--   - definizione vecchia a tre colonne (PART_WIDTH = pz.X) -> ALTER alla
--     nuova;
--   - qualunque altra                             -> FERMO, non sovrascrive:
--     la fonte di verita' e' sys.sql_modules, non il repo (vedi la scheda
--     WORKORDERS in APPUNTI-CELLA).
-- La vista e il PLC vanno insieme: FB_Robot dal 5/10 chiede cinque colonne;
-- con la vista a tre la lettura del soffiaggio fallisce.
--
-- ORDINE DI DEPLOY: dopo vice-claw-length.sql e piece-on-vice.sql, che creano
-- le colonne lette qui. A cella ferma, con -E:
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-blow-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NULL
   OR OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
BEGIN
	PRINT 'MANCANO colonne o tabelle: eseguire prima vice-claw-length.sql e piece-on-vice.sql.';
	SET NOEXEC ON;
END
GO

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_BLOW_MC'));

-- confronto a spazi normalizzati: a capo, tabulazioni e spazi multipli
-- diventano un singolo spazio, cosi' la guardia non dipende da come la
-- definizione e' stata formattata. ISNULL senza spazio dopo la virgola, come
-- lo restituisce OBJECT_DEFINITION in cella (la normalizzazione non lo
-- aggiunge: con ", 0" la guardia direbbe FERMO sulla vista giusta).
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');

IF @def IS NULL
	PRINT 'coordinates-blow-mc: la vista non esiste, la creo.';
-- gia' quella nuova: le cinque colonne con ISNULL, PIECE in INNER, VICE in
-- LEFT, la dichiarazione legata alla morsa
ELSE IF @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Y,0) as PART_WIDTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
	 AND @norm LIKE N'%ISNULL(pz.X,0) as PART_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Z,0) as PART_HEIGHT%'
	 AND @norm LIKE N'%inner join PIECE pz on pz.ID = w.PIECE_ID%'
	 AND @norm LIKE N'%left join VICE v on v.PALLET_ID = w.PALLET_ID%'
	 AND @norm LIKE N'%pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID%'
BEGIN
	PRINT 'coordinates-blow-mc: vista gia'' presente e conforme, nessuna modifica.';
	SET NOEXEC ON;
END
-- la vecchia a tre colonne del 18/9 (PART_WIDTH = pz.X, la lunghezza):
-- si porta alla nuova
ELSE IF @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.X,0) as PART_WIDTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
	 AND @norm LIKE N'%pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID%'
	 AND @norm NOT LIKE N'%PART_LENGTH%'
	 AND @norm NOT LIKE N'%PART_HEIGHT%'
	PRINT 'coordinates-blow-mc: trovata la definizione a tre colonne (PART_WIDTH = pz.X): la porto alla nuova.';
ELSE
BEGIN
	PRINT 'coordinates-blow-mc: la vista esiste ma NON e'' quella attesa. FERMO.';
	PRINT 'Leggerla con: SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(''dbo.COORDINATES_BLOW_MC'');';
	PRINT 'e riconciliare a mano: il testo qui sotto sovrascriverebbe modifiche che non conosco.';
	SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.COORDINATES_BLOW_MC') IS NULL
	EXEC('CREATE VIEW dbo.COORDINATES_BLOW_MC AS SELECT 1 AS segnaposto');
GO

ALTER VIEW dbo.COORDINATES_BLOW_MC AS
select  w.ID                            as ORDER_ID,
        w.MACHINE_ID                    as MC,
        ISNULL(v.CLAW_LENGTH,0)         as CLAW_LENGTH,
        ISNULL(pz.Y,0)                  as PART_WIDTH,
        ISNULL(pv.STOP_BEYOND_CLAW,0)   as STOP_BEYOND_CLAW,
        ISNULL(pz.X,0)                  as PART_LENGTH,
        ISNULL(pz.Z,0)                  as PART_HEIGHT
from WORKORDER w
inner join PIECE pz     on pz.ID = w.PIECE_ID
left  join VICE v       on v.PALLET_ID = w.PALLET_ID
left  join PIECE_ON_VICE pv on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID;
GO
PRINT 'coordinates-blow-mc: fatto.';
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA
--
-- 1) La riga dell'ordine di riscontro (5/10):
--    SELECT * FROM COORDINATES_BLOW_MC WHERE ORDER_ID = 2117;
--    Atteso: PART_LENGTH 40000, PART_WIDTH 109900, PART_HEIGHT 15000
--    (pezzo 1035); CLAW_LENGTH e STOP_BEYOND_CLAW quelli della morsa.
--
-- 2) Le misure sono quelle del PEZZO, colonna per colonna — e' il controllo
--    che e' mancato dal 18/9 al 5/10:
--    SELECT b.ORDER_ID FROM COORDINATES_BLOW_MC b
--      JOIN WORKORDER w ON w.ID = b.ORDER_ID
--      JOIN PIECE p ON p.ID = w.PIECE_ID
--     WHERE b.PART_LENGTH <> ISNULL(p.X,0) OR b.PART_WIDTH <> ISNULL(p.Y,0)
--        OR b.PART_HEIGHT <> ISNULL(p.Z,0);
--    Atteso: nessuna riga.
--
-- 3) Nessuna colonna NULL, su nessun ordine — e' tutto il senso degli ISNULL:
--    SELECT ORDER_ID FROM COORDINATES_BLOW_MC
--     WHERE CLAW_LENGTH IS NULL OR PART_WIDTH IS NULL OR STOP_BEYOND_CLAW IS NULL
--        OR PART_LENGTH IS NULL OR PART_HEIGHT IS NULL;
--    Atteso: nessuna riga.
--
-- 4) Un ordine per riga: la vista non deve moltiplicare niente. Se esce una
--    riga, c'e' piu' di una morsa sullo stesso pallet o piu' di una
--    dichiarazione per la stessa coppia morsa+pezzo.
--    SELECT ORDER_ID, COUNT(*) AS righe FROM COORDINATES_BLOW_MC
--     GROUP BY ORDER_ID HAVING COUNT(*) > 1;
--    Atteso: nessuna riga.
--
-- 5) La query che lancia il PLC (FB_Robot, tre punti), per contarne i
--    caratteri: 115 con ORDER_ID a 4 cifre, 116 a 5, sotto i 254 di queryTemp:
--    select CLAW_LENGTH,PART_WIDTH,STOP_BEYOND_CLAW,PART_LENGTH,PART_HEIGHT from COORDINATES_BLOW_MC where ORDER_ID=2117
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (manuale). Alla definizione del 18/9: quella salvata in
-- D:\Backup\COORDINATES_BLOW_MC_20261005.txt sul PC di cella. ATTENZIONE:
-- FB_Robot dal 5/10 legge cinque colonne; con la vista a tre la lettura del
-- soffiaggio fallisce, quindi si torna indietro insieme al PLC.
-- Nessun altro oggetto dipende da questa vista: e' di sola lettura e la
-- consuma il solo PLC.
-- ===========================================================================
