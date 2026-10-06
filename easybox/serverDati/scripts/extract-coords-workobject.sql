-- ===========================================================================
-- extract-coords-workobject.sql - quote di ESTRAZIONE dei cassetti relative
-- al work object del cassetto (6/10)
--
-- PERCHE'. Con un work object per cassetto (numero in N_Cassetto, %QW644)
-- anche estrazione (25) e rilascio (26) usano il WO del cassetto: "la
-- posizione 0 e' come prima, si usa anche per l'estrazione" (Dario, 6/10).
-- Le righe [POSITION] con PARENT 'EXTRACT_TRAY_n', lette da FB7 attraverso la
-- vista COORDINATES_FOR_EXTRACT, oggi sono ASSOLUTE nel riferimento unico
-- della cassettiera: vanno rese relative al cassetto. Vista e PLC non
-- cambiano: cambiano solo questi 12 record.
--
-- REGOLA (decisione di Dario, 6/10): si conserva la differenza fra prelievo
-- e cassetto che era gia' corretta. Per ogni piano n:
--   X := X - TRAY.X_CORR(n)
--   Y := Y - TRAY.Y_CORR(n)
--   Z := Z - TRAY.Z_CORR(n)
-- E' la stessa quantita' che la vista v4 toglie dalle quote delle tasche:
-- se il WO del cassetto n coincide col vecchio riferimento spostato delle
-- correzioni TRAY del piano n, il robot va esattamente dove andava prima.
-- NON si toccano: X_CORR, Y_CORR, Z_CORR della riga di estrazione (restano
-- per le correzioni a mano dalla pagina Posizioni, +-5 mm), rotazioni,
-- avvicinamenti, tabella TRAY.
--
-- ATTESO con i dati letti in cella il 6/10 (TRAY X_CORR e Y_CORR = 0 su
-- tutti i piani; Z estrazione 55000 + 100000*(n-1); TRAY.Z_CORR 99800*(n-1),
-- piano 7 598550). Lo script stampa comunque i valori veri prima e dopo.
--   X invariata: 630000 (piano 8: 627000)     Y invariata: 415000
--   Z: 1 55000 | 2 55200 | 3 55400 | 4 55600 | 5 55800 | 6 56000
--      7 56450 | 8 56400 | 9 56600 | 10 56800 | 11 57000 | 12 57200
-- La Z sale di 0,2 mm a piano perche' le righe di estrazione avevano passo
-- 100 mm e i cassetti 99,8: e' ereditato dalla tabella vecchia, non e'
-- geometria. Si corregge a mano se serve.
--
-- QUANDO: nella STESSA fermata in cui il robot passa ai WO per cassetto e si
-- applica la vista v4 (robot-tray-view-v4.sql), MAI prima. Con il programma
-- robot vecchio, il rilascio di un cassetto alto (es. 8: Z 56400 invece di
-- 755000) andrebbe all'altezza del piano 1. Per questo lo script parte solo
-- con -v ROBOT_WO=SI sulla riga di comando.
--
-- COMANDO (da PowerShell, in cella; il file in D:\Backup e' il backup delle
-- quote vecchie, insieme alla tabella dbo.POSITION_EXTRACT_PRE_WO):
--
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -v ROBOT_WO=SI -i extract-coords-workobject.sql -o D:\Backup\estrazione_prima_WO.txt; Get-Content D:\Backup\estrazione_prima_WO.txt
--
-- GUARDIE (qualunque FERMO = nessuna scrittura):
--   - ROBOT_WO diverso da SI;
--   - tabella di backup gia' presente (script gia' eseguito o tentato);
--   - righe EXTRACT diverse da 12, piani non 1..12 tutti distinti, piano
--     senza esattamente una riga TRAY;
--   - quota nuova fuori campo (Z fra 0 e 150 mm, X e Y fra 0 e 1000 mm,
--     sulla quota effettiva con la correzione della riga): prende anche il
--     doppio lancio, che porterebbe in negativo i piani dal 2 in su.
-- Backup e UPDATE stanno in una transazione sola: se il controllo dopo
-- l'UPDATE non trova 12 righe giuste si annulla tutto, backup compreso.
-- Su [POSITION] c'e' POSITION_trig (solo log AFTER UPDATE verso [log],
-- APPUNTI-CELLA 4/9): i conteggi sono COUNT espliciti, non @@ROWCOUNT.
-- ===========================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @nRighe int, @nPiani int, @nTray int, @nFuori int, @nBk int, @nOk int, @nDopo int;

IF '$(ROBOT_WO)' <> 'SI'
BEGIN
	PRINT 'FERMO: manca -v ROBOT_WO=SI. Lo script va lanciato solo insieme al passaggio del robot ai work object per cassetto.';
	RETURN;
END

PRINT '=== PRIMA: righe di estrazione, correzioni del cassetto, quote nuove ===';
SELECT p.ID, RTRIM(p.PARENT) AS PARENT,
	p.X, p.X_CORR, p.Y, p.Y_CORR, p.Z, p.Z_CORR,
	t.X_CORR AS TRAY_X_CORR, t.Y_CORR AS TRAY_Y_CORR, t.Z_CORR AS TRAY_Z_CORR, t.[EXTRACT] AS TRAY_EXTRACT,
	p.X - ISNULL(t.X_CORR,0) AS X_NUOVA, p.Y - ISNULL(t.Y_CORR,0) AS Y_NUOVA, p.Z - ISNULL(t.Z_CORR,0) AS Z_NUOVA
FROM [POSITION] p
LEFT JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
WHERE p.PARENT LIKE 'EXTRACT%'
ORDER BY CAST(SUBSTRING(p.PARENT,14,50) AS int);

IF OBJECT_ID('dbo.POSITION_EXTRACT_PRE_WO','U') IS NOT NULL
BEGIN
	PRINT 'FERMO: dbo.POSITION_EXTRACT_PRE_WO esiste gia'': lo script e'' gia'' stato eseguito o tentato. Nessuna modifica. Controllare a mano prima di qualunque altra cosa.';
	RETURN;
END

SELECT @nRighe = COUNT(*) FROM [POSITION] WHERE PARENT LIKE 'EXTRACT%';

SELECT @nPiani = COUNT(DISTINCT f) FROM (
	SELECT CAST(SUBSTRING(PARENT,14,50) AS int) AS f
	FROM [POSITION] WHERE PARENT LIKE 'EXTRACT[_]TRAY[_]%'
) x WHERE f BETWEEN 1 AND 12;

SELECT @nTray = COUNT(*) FROM [POSITION] p
WHERE p.PARENT LIKE 'EXTRACT%'
	AND (SELECT COUNT(*) FROM TRAY t WHERE t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)) = 1;

SELECT @nFuori = COUNT(*) FROM [POSITION] p
JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
WHERE p.PARENT LIKE 'EXTRACT%'
	AND (p.X IS NULL OR p.Y IS NULL OR p.Z IS NULL
		OR NOT (p.Z + ISNULL(p.Z_CORR,0) - ISNULL(t.Z_CORR,0) BETWEEN 0 AND 150000
			AND p.X + ISNULL(p.X_CORR,0) - ISNULL(t.X_CORR,0) BETWEEN 0 AND 1000000
			AND p.Y + ISNULL(p.Y_CORR,0) - ISNULL(t.Y_CORR,0) BETWEEN 0 AND 1000000));

PRINT 'conteggi PRIMA: righe EXTRACT ' + CAST(@nRighe AS varchar(10)) + ' (attese 12), piani distinti 1..12 ' + CAST(@nPiani AS varchar(10))
	+ ' (attesi 12), righe con una sola riga TRAY ' + CAST(@nTray AS varchar(10)) + ' (attese 12), quote nuove fuori campo ' + CAST(@nFuori AS varchar(10)) + ' (atteso 0)';

IF @nRighe <> 12 OR @nPiani <> 12 OR @nTray <> 12
BEGIN
	PRINT 'FERMO: le righe di estrazione o i cassetti non sono quelli attesi (vedi conteggi). Nessuna modifica.';
	RETURN;
END

IF @nFuori > 0
BEGIN
	PRINT 'FERMO: almeno una quota nuova esce dal campo (colonne X_NUOVA, Y_NUOVA, Z_NUOVA sopra). Gia'' relative, o dati inattesi. Nessuna modifica.';
	RETURN;
END

IF EXISTS (SELECT 1 FROM TRAY WHERE ISNULL([EXTRACT],0) <> 0)
	PRINT 'ATTENZIONE: ci sono cassetti fuori o in manovra (colonna TRAY_EXTRACT). Il loro rilascio (26) usera'' le quote nuove: il robot deve gia'' usare il WO di quei cassetti. (Il piano 1 non cambia: correzioni TRAY a 0.)';

BEGIN TRAN;

SELECT * INTO dbo.POSITION_EXTRACT_PRE_WO FROM [POSITION] WHERE PARENT LIKE 'EXTRACT%';

UPDATE p SET
	p.X = p.X - ISNULL(t.X_CORR,0),
	p.Y = p.Y - ISNULL(t.Y_CORR,0),
	p.Z = p.Z - ISNULL(t.Z_CORR,0)
FROM [POSITION] p
JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
WHERE p.PARENT LIKE 'EXTRACT%';

SELECT @nBk = COUNT(*) FROM dbo.POSITION_EXTRACT_PRE_WO;

SELECT @nOk = COUNT(*) FROM [POSITION] p
JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
WHERE p.PARENT LIKE 'EXTRACT%'
	AND p.X = b.X - ISNULL(t.X_CORR,0)
	AND p.Y = b.Y - ISNULL(t.Y_CORR,0)
	AND p.Z = b.Z - ISNULL(t.Z_CORR,0)
	AND ISNULL(p.X_CORR,0) = ISNULL(b.X_CORR,0)
	AND ISNULL(p.Y_CORR,0) = ISNULL(b.Y_CORR,0)
	AND ISNULL(p.Z_CORR,0) = ISNULL(b.Z_CORR,0);

IF @nBk <> 12 OR @nOk <> 12
BEGIN
	ROLLBACK TRAN;
	PRINT 'FERMO: controllo dopo l''UPDATE fallito (backup ' + CAST(@nBk AS varchar(10)) + ', righe giuste ' + CAST(@nOk AS varchar(10)) + ', attese 12). Annullato tutto, backup compreso.';
	RETURN;
END

COMMIT TRAN;

SELECT @nDopo = COUNT(*) FROM [POSITION] WHERE PARENT LIKE 'EXTRACT%';
PRINT 'conteggi DOPO: righe EXTRACT ' + CAST(@nDopo AS varchar(10)) + ' (attese 12), righe nel backup dbo.POSITION_EXTRACT_PRE_WO ' + CAST(@nBk AS varchar(10)) + ', righe aggiornate e verificate ' + CAST(@nOk AS varchar(10));

PRINT '=== DOPO: COORDINATES_FOR_EXTRACT (quello che legge FB7) ===';
SELECT TRAY, MAG, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z
FROM COORDINATES_FOR_EXTRACT ORDER BY TRAY;

PRINT 'FATTO: quote di estrazione relative al cassetto. Backup in dbo.POSITION_EXTRACT_PRE_WO.';

-- ===========================================================================
-- ROLLBACK: solo INSIEME al ritorno della vista v3 (definizione nel file
-- D:\Backup\vista4Robot_prima_v4.txt) e del robot al riferimento unico.
-- Rimette X, Y, Z del backup. Le correzioni a mano fatte dopo il passaggio
-- stanno in X_CORR, Y_CORR, Z_CORR e NON vengono toccate: controllarle.
-- Da lanciare a mano (SSMS o sqlcmd), una riga alla volta o tutto insieme:
--
-- SET XACT_ABORT ON; BEGIN TRAN;
-- UPDATE p SET p.X = b.X, p.Y = b.Y, p.Z = b.Z
--   FROM [POSITION] p JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID;
-- SELECT COUNT(*) AS ripristinate FROM [POSITION] p JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
--   WHERE p.X = b.X AND p.Y = b.Y AND p.Z = b.Z;   -- atteso 12, altrimenti ROLLBACK TRAN
-- COMMIT TRAN;
--
-- La tabella dbo.POSITION_EXTRACT_PRE_WO si tiene finche' i WO non sono
-- collaudati su tutti i 12 cassetti. Non va cancellata da questo script.
-- ===========================================================================
