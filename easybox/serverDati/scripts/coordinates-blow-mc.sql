-- ===========================================================================
-- coordinates-blow-mc.sql — vista COORDINATES_BLOW_MC (SOFFIAGGIO, 18/9;
-- dati pezzo al robot, 5/10; ingombro chela e quota di presa, 20/10)
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
-- MAPPA PROFINET DELLE MISURE (Robot_Efort), dal 6/10 circa le 17:
--   %QW634  Vice_ClawLength_mm  = CLAW_LENGTH
--   %QW636  Part_Width_mm       = PART_LENGTH  (PIECE.X)   (6/10: era PART_WIDTH)
--   %QW638  X_Support_mm        = CLAW_LENGTH/2 + STOP_BEYOND_CLAW
--   %QW640  Part_Length_mm      = PART_WIDTH   (PIECE.Y)   (6/10: era PART_LENGTH)
--   %QW642  Part_Height_mm      = PART_HEIGHT  (PIECE.Z)
--   %QW644  N_Cassetto (6/10)
--   %QW646  Z_Push_LOW, %QW648 Z_Push_HIGH (6/10, quota Z della spinta,
--           consegna 31, ex spare_7/spare_8: COORDINATES_PUSH_MC.Z_PUSH_DROP)
--   %QW650  Sys_SetRobotspeed (non e' una misura: la nota del 6/10 la dava
--           libera, nell'export della V2026_1_6 e' occupata)
--   %QW652  Gripper_ClawWidth_mm = GRIPPER_CLAW_LENGTH (20/10, ex spare_10)
--   %QW654  Part_ZPick_mm        = PART_Z_PICK         (20/10, ex spare_11)
--   libere da %QW656 a %QW666.
--
-- INGOMBRO DELLA CHELA E QUOTA DI PRESA (20/10, richiesta del robotista via
-- Dario). In deposito in macchina il robotista vuole sapere quanto e' larga
-- la chela della pinza e a che altezza del pezzo la tiene:
--   GRIPPER_CLAW_LENGTH  ISNULL(GRIPPER.CLAW_LENGTH, 0) della pinza
--                        dell'ordine. E' la misura col calibro della spinta in
--                        battuta (gripper-claw-length.sql), che la pagina
--                        Pinza chiama "lunghezza nella direzione in cui spinge
--                        il pezzo". Per il robotista e' la LARGHEZZA della
--                        chela: il nome della variabile segue il robot, quello
--                        della colonna segue l'anagrafica (stessa lezione del
--                        6/10). NULL = non misurata -> 0.
--   PART_Z_PICK          ISNULL(PIECE.Z_PICK, 0): quota di presa dal fondo
--                        del grezzo, la stessa con cui COORDINATES_Z_MC calcola
--                        la Z di deposito in macchina. NULL -> 0.
-- La pinza e' quella dell'ORDINE (WORKORDER.GRIPPER_ID), con lo stesso join
-- della vista WORKORDERS (ID modulo 1000). In automatico e' la pinza a bordo:
-- FB204 la monta al 35 prima di lavorare. Con i comandi dal pannello l'ordine
-- e' quello scelto dal PLC (OrderIdMC o il piu' recente) e la pinza a bordo
-- potrebbe non essere la sua. GRIPPER in LEFT: senza pinza (ordini di
-- attrezzatura, GRIPPER_ID 0) l'ordine resta nella vista con 0.
-- Pinza doppia: la riga e' quella del lato 1, dove sta il grezzo.
-- Il 6/10 Dario ha scambiato X e Y NEL PLC (per il robot erano invertite;
-- la Z non e' mai stata toccata): la vista resta questa, quindi i nomi delle
-- colonne qui e quelli delle variabili PROFINET non coincidono piu'.
-- Riscontro col pezzo 1035 (X 40, Y 109, Z 15): Width 40, Length 109,
-- Height 15. test_push_to_stop.js controlla la mappa nei tre stati del PLC.
--
-- SEMANTICA DELLE MISURE DEL PEZZO: due vocabolari.
--   Anagrafica e pagina Pezzo: PIECE.X etichettata L (D se cilindro),
--   PIECE.Y = W, PIECE.Z = H.
--   Robot (dal 6/10, riscontrato in cella col pezzo 1035):
--   Part_Width_mm = PIECE.X, Part_Length_mm = PIECE.Y,
--   Part_Height_mm = PIECE.Z.
-- Le colonne PART_WIDTH / PART_LENGTH di questa vista seguono l'anagrafica,
-- non il robot: una variabile PROFINET non si deduce dal nome della
-- colonna, vale la MAPPA qui sopra.
--
-- STORIA: dal 18/9 al 5/10 PART_WIDTH era pz.X, e su %QW636 andava quella.
-- La nota P8 del 5/10 l'aveva "confermata" come larghezza confrontando la
-- definizione della vista. Il 5/10 la vista e' stata girata (PART_WIDTH =
-- pz.Y) seguendo l'etichetta W dell'anagrafica: corretta in cella alle
-- 19:17 con un ALTER VIEW guardato; il backup della definizione precedente
-- sta sul PC di cella in D:\Backup\COORDINATES_BLOW_MC_20261005.txt. Il 6/10
-- il robot ha mostrato che per lui era giusto il comportamento precedente
-- su %QW636 (PIECE.X). Dario ha scelto di lasciare la vista com'e' e di
-- incrociare X e Y nel PLC (d89b2de). Lezione: si confronta con quello che
-- fa il robot, non con un nome, che sia di colonna, di tag o di etichetta.
-- La VERIFICA 2 qui sotto prova solo che la vista segue l'anagrafica.
--
-- PERCHE' UNA VISTA E NON UNA QUERY DIRETTA. Con i join scritti a mano la
-- query (a tre colonne) misurava 298 caratteri contro i 254 di queryTemp nel
-- PLC: sarebbe arrivata TRONCATA, cioe' lo stesso difetto dell'allarme 13599
-- del 15/9, che non da' errore ma dati sbagliati. Con la vista la query del
-- PLC a cinque colonne sta in 116 caratteri (ORDER_ID a 5 cifre). La
-- lunghezza qui e' un vincolo di correttezza, non di stile: chiunque
-- aggiunga colonne tenga il SELECT del PLC sotto i 254. Con le sette colonne
-- del 20/10: 148 caratteri con ORDER_ID a 5 cifre; i due rami manuali con la
-- sottoquery (scambio e prelievo dal pannello) 219 e 222.
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
-- STATO: la vista e' in cella dal 18/9; dal 5/10 19:17 ha la definizione a
-- cinque colonne. Il 20/10 diventa a sette (qui sotto). La guardia:
--   - definizione nuova (sette colonne)            -> "conforme", niente;
--   - definizione a cinque colonne del 5/10        -> ALTER alla nuova;
--   - definizione vecchia a tre colonne (PART_WIDTH = pz.X) -> ALTER alla
--     nuova;
--   - qualunque altra                              -> FERMO, non sovrascrive:
--     la fonte di verita' e' sys.sql_modules, non il repo (vedi la scheda
--     WORKORDERS in APPUNTI-CELLA).
-- La vista e il PLC vanno insieme, IN QUEST'ORDINE: prima la vista, poi il
-- PLC. Il FB_Robot di oggi chiede cinque colonne per nome e con la vista a
-- sette continua a funzionare; il FB_Robot del 20/10 ne chiede sette, e con
-- la vista a cinque la query fallisce: il robot riceverebbe i valori vecchi
-- di TUTTE le misure, non solo delle due nuove.
--
-- ORDINE DI DEPLOY: dopo vice-claw-length.sql, piece-on-vice.sql e
-- gripper-claw-length.sql, che creano le colonne lette qui. A cella ferma:
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i coordinates-blow-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NULL
   OR OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
   OR COL_LENGTH('dbo.GRIPPER', 'CLAW_LENGTH') IS NULL
   OR COL_LENGTH('dbo.PIECE', 'Z_PICK') IS NULL
BEGIN
	PRINT 'MANCANO colonne o tabelle: eseguire prima vice-claw-length.sql, piece-on-vice.sql e gripper-claw-length.sql. Nessuna modifica.';
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
-- gia' quella nuova (20/10): le sette colonne con ISNULL, PIECE in INNER,
-- VICE e GRIPPER in LEFT, la dichiarazione legata alla morsa
ELSE IF @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Y,0) as PART_WIDTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
	 AND @norm LIKE N'%ISNULL(pz.X,0) as PART_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Z,0) as PART_HEIGHT%'
	 AND @norm LIKE N'%ISNULL(g.CLAW_LENGTH,0) as GRIPPER_CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Z_PICK,0) as PART_Z_PICK%'
	 AND @norm LIKE N'%inner join PIECE pz on pz.ID = w.PIECE_ID%'
	 AND @norm LIKE N'%left join VICE v on v.PALLET_ID = w.PALLET_ID%'
	 AND @norm LIKE N'%pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID%'
	 AND @norm LIKE N'%left join GRIPPER g on g.ID = w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)%'
BEGIN
	PRINT 'coordinates-blow-mc: vista gia'' presente e conforme (sette colonne), nessuna modifica.';
	SET NOEXEC ON;
END
-- quella a cinque colonne del 5/10, in cella fino al 20/10: si porta alla
-- nuova aggiungendo le due colonne in fondo
ELSE IF @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Y,0) as PART_WIDTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
	 AND @norm LIKE N'%ISNULL(pz.X,0) as PART_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Z,0) as PART_HEIGHT%'
	 AND @norm LIKE N'%inner join PIECE pz on pz.ID = w.PIECE_ID%'
	 AND @norm LIKE N'%left join VICE v on v.PALLET_ID = w.PALLET_ID%'
	 AND @norm LIKE N'%pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID%'
	 AND @norm NOT LIKE N'%GRIPPER_CLAW_LENGTH%'
	 AND @norm NOT LIKE N'%PART_Z_PICK%'
	 AND @norm NOT LIKE N'%join GRIPPER%'
	PRINT 'coordinates-blow-mc: trovata la definizione a cinque colonne del 5/10: la porto alla nuova (sette colonne).';
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
        ISNULL(pz.Z,0)                  as PART_HEIGHT,
        ISNULL(g.CLAW_LENGTH,0)         as GRIPPER_CLAW_LENGTH,
        ISNULL(pz.Z_PICK,0)             as PART_Z_PICK
from WORKORDER w
inner join PIECE pz     on pz.ID = w.PIECE_ID
left  join VICE v       on v.PALLET_ID = w.PALLET_ID
left  join PIECE_ON_VICE pv on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID
left  join GRIPPER g    on g.ID = w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000);
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
-- 2b) (20/10) Le due colonne nuove vengono dalla pinza dell'ordine e dal
--    pezzo:
--    SELECT b.ORDER_ID FROM COORDINATES_BLOW_MC b
--      JOIN WORKORDER w ON w.ID = b.ORDER_ID
--      JOIN PIECE p ON p.ID = w.PIECE_ID
--      LEFT JOIN GRIPPER g ON g.ID = w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)
--     WHERE b.GRIPPER_CLAW_LENGTH <> ISNULL(g.CLAW_LENGTH,0)
--        OR b.PART_Z_PICK <> ISNULL(p.Z_PICK,0);
--    Atteso: nessuna riga.
--    E, per l'ordine che si sta per lavorare, i valori in mm che andranno al
--    robot (Gripper_ClawWidth_mm, Part_ZPick_mm):
--    SELECT ORDER_ID, GRIPPER_CLAW_LENGTH/1000 AS chela_mm, PART_Z_PICK/1000 AS z_presa_mm
--      FROM COORDINATES_BLOW_MC ORDER BY ORDER_ID DESC;
--
-- 3) Nessuna colonna NULL, su nessun ordine — e' tutto il senso degli ISNULL:
--    SELECT ORDER_ID FROM COORDINATES_BLOW_MC
--     WHERE CLAW_LENGTH IS NULL OR PART_WIDTH IS NULL OR STOP_BEYOND_CLAW IS NULL
--        OR PART_LENGTH IS NULL OR PART_HEIGHT IS NULL
--        OR GRIPPER_CLAW_LENGTH IS NULL OR PART_Z_PICK IS NULL;
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
--    caratteri: dal 20/10 147 con ORDER_ID a 4 cifre, 148 a 5, sotto i 254
--    di queryTemp (i due rami manuali con la sottoquery: 219 e 222):
--    select CLAW_LENGTH,PART_WIDTH,STOP_BEYOND_CLAW,PART_LENGTH,PART_HEIGHT,GRIPPER_CLAW_LENGTH,PART_Z_PICK from COORDINATES_BLOW_MC where ORDER_ID=2117
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (manuale), DAL 20/10: PRIMA il PLC (FB_Robot che legge cinque
-- colonne), POI la vista. Al contrario, il FB_Robot a sette colonne non
-- trova le due nuove, la query fallisce e il robot riceve i valori vecchi di
-- tutte le misure. Definizione a cinque colonne: quella del 5/10 qui sopra
-- senza le due righe GRIPPER_CLAW_LENGTH e PART_Z_PICK e senza il join su
-- GRIPPER (nel repo: questo file prima del 20/10).
-- Alla definizione del 18/9: quella salvata in
-- D:\Backup\COORDINATES_BLOW_MC_20261005.txt sul PC di cella. ATTENZIONE:
-- FB_Robot dal 5/10 legge cinque colonne; con la vista a tre la lettura del
-- soffiaggio fallisce, quindi si torna indietro insieme al PLC.
-- Nessun altro oggetto dipende da questa vista: e' di sola lettura e la
-- consuma il solo PLC.
-- ===========================================================================
