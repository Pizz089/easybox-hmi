-- ===========================================================================
-- vice-jaw-controlli.sql - SOLA LETTURA, prima del catalogo delle chele
-- (7/10, prompt 5 di 5)
--
-- Dice, sui dati veri della cella, cosa toccherebbe vice-jaw.sql e cosa
-- cambierebbe la variante "morsa senza tipo = nessuna riga". Non scrive
-- niente: solo SELECT.
--   1. le morse: quali diventano un tipo "Chele attuali <famiglia>", con
--      che codice, e se hanno zeri (diventano NULL nel tipo, stesse quote)
--      o negativi (la migrazione si fermerebbe);
--   2. le righe di PIECE_ON_VICE e la CLAW_LENGTH_REF che prenderebbero;
--   3. gli ordini per stato;
--   4. VARIANTE da decidere (non applicata): con "morsa sul pallet ma senza
--      tipo di chele = nessuna riga in COORDINATES_Z_MC" invece di ISNULL a 0,
--      questi ordini si fermerebbero col 799. Oggi su quelle morse la quota
--      di deposito esce senza l'appoggio delle chele, cioe' troppo bassa.
--
-- COMANDO (cella, PowerShell; il file va copiato in D:\Backup prima del
-- git pull, perche' in cella non c'e' ancora):
--   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-controlli.sql -o D:\Backup\vice-jaw-controlli_esito.txt; Get-Content D:\Backup\vice-jaw-controlli_esito.txt
-- ===========================================================================
SET NOCOUNT ON;

PRINT '== 1. MORSE: cosa diventa tipo di chele ==';
SELECT v.ID, RTRIM(v.FAMILY) AS FAMILY, v.STATUS, v.PALLET_ID,
	   v.CLAW_LENGTH, v.Z_CLAW, v.Z_SINK_CLAW,
	   CASE WHEN v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL THEN 'SI' ELSE 'no (nessuna misura)' END AS diventa_tipo,
	   CASE WHEN v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL
			THEN N'Chele attuali ' + ISNULL(RTRIM(v.FAMILY), N'morsa')
				 + CASE WHEN (SELECT COUNT(*) FROM dbo.VICE x WHERE ISNULL(RTRIM(x.FAMILY), N'') = ISNULL(RTRIM(v.FAMILY), N'')) > 1
						THEN N' (morsa ' + CAST(v.ID AS nvarchar(12)) + N')' ELSE N'' END END AS codice_tipo,
	   CASE WHEN v.CLAW_LENGTH = 0 OR v.Z_CLAW = 0 THEN 'zero -> NULL nel tipo (stesse quote)' ELSE '' END AS zeri,
	   CASE WHEN v.CLAW_LENGTH < 0 OR v.Z_CLAW < 0 OR v.Z_SINK_CLAW < 0 THEN 'NEGATIVO: la migrazione si ferma' ELSE '' END AS negativi
  FROM dbo.VICE v
 ORDER BY v.ID;

PRINT '== 2. BATTUTE (PIECE_ON_VICE) e chela con cui risultano dichiarate ==';
SELECT pv.VICE_ID, pv.PIECE_ID, RTRIM(p.FAMILY) AS PEZZO, p.Y AS PEZZO_Y, pv.STOP_BEYOND_CLAW, pv.COMP_PUSH,
	   CASE WHEN v.ID IS NULL THEN 'orfana (morsa assente)' ELSE '' END AS morsa,
	   CASE WHEN v.CLAW_LENGTH > 0 THEN v.CLAW_LENGTH END AS CLAW_LENGTH_REF_dopo
  FROM dbo.PIECE_ON_VICE pv
  LEFT JOIN dbo.VICE v ON v.ID = pv.VICE_ID
  LEFT JOIN dbo.PIECE p ON p.ID = pv.PIECE_ID
 ORDER BY pv.VICE_ID, pv.PIECE_ID;

PRINT '== 3. ORDINI per stato ==';
SELECT w.STATUS, RTRIM(st.DESCR) AS STATO, COUNT(*) AS ordini
  FROM dbo.WORKORDER w LEFT JOIN dbo.[_STATUS_TYPE] st ON st.ID = w.STATUS
 GROUP BY w.STATUS, st.DESCR ORDER BY w.STATUS;

PRINT '== 4. VARIANTE (non applicata): ordini su pallet con una morsa SENZA misure, che si fermerebbero col 799 ==';
SELECT w.ID AS ORDER_ID, w.STATUS, RTRIM(st.DESCR) AS STATO, w.PALLET_ID, v.ID AS VICE_ID, RTRIM(v.FAMILY) AS MORSA,
	   RTRIM(p.FAMILY) AS PEZZO, w.QUANTITY
  FROM dbo.WORKORDER w
  JOIN dbo.VICE v ON v.PALLET_ID = w.PALLET_ID
  LEFT JOIN dbo.PIECE p ON p.ID = w.PIECE_ID
  LEFT JOIN dbo.[_STATUS_TYPE] st ON st.ID = w.STATUS
 WHERE v.CLAW_LENGTH IS NULL AND v.Z_CLAW IS NULL AND v.Z_SINK_CLAW IS NULL
 ORDER BY w.STATUS, w.ID;
PRINT '   (di quelli sopra contano gli ordini non ancora finiti: in coda e attivi)';

PRINT '== 5. CHI LEGGE VICES (atteso: nessuna vista ne procedura) ==';
SELECT OBJECT_NAME(d.referencing_id) AS oggetto, o.type_desc
  FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id = d.referencing_id
 WHERE d.referenced_entity_name = N'VICES';

PRINT '== 6. COLONNE DI VICE (la vista VICES nuova le elenca: atteso nessuna oltre quelle note) ==';
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VICE')
   AND name NOT IN (N'ID', N'FAMILY', N'DESCR', N'STATUS', N'X', N'Y', N'Z', N'Z_CLAW', N'Z_SINK_CLAW',
					N'MAG', N'MAG_POS', N'POS_PLANT', N'PALLET_ID', N'CLAW_LENGTH', N'JAW_ID');
