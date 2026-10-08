-- ===========================================================================
-- vice-jaw-controlli.sql - SOLA LETTURA, prima del catalogo delle chele
-- (7/10, prompt 5 di 5; 8/10, prompt 8: anche quello che c'era solo in
-- controlli-audit-8-10.sql)
--
-- Dice, sui dati veri della cella, cosa toccherebbe vice-jaw.sql. Non scrive
-- niente: solo SELECT.
--   1. le morse: quali diventano un tipo "Chele attuali morsa <ID>", e se
--      hanno zeri (diventano NULL nel tipo, stesse quote) o negativi (la
--      migrazione si fermerebbe);
--   2. le righe di PIECE_ON_VICE e il tipo di riferimento che prenderebbero
--      (quello creato per la loro morsa), con le battute a 0;
--   3. gli ordini per stato;
--   4. (8/10) ordini su un pallet con una morsa SENZA misure: dopo la
--      migrazione quella morsa non ha un tipo montato, e il backend rifiuta
--      il passaggio a STATUS 3 (Play o rilancio: KO_ORDER_VICE_NO_JAW) finche'
--      non le si monta un tipo. Prima qui c'era la variante "morsa senza tipo
--      = nessuna riga nella vista", tolta l'8/10: la vista non nasconde piu'
--      righe (vedi coordinates-z-mc.sql);
--   5, 6. chi legge VICES e le colonne di VICE (la vista nuova le elenca);
--   7. se VICE.ID e' IDENTITY (lo e' in cella dall'8/10: "crea morsa" non
--      passa piu' l'ID, CONF/Vice.js insertVice);
--   8. (8/10) i TIPI delle colonne di VICE (FAMILY e DESCR nchar: RTRIM);
--   9. (8/10) i trigger su VICE, PALLET, WORKORDER e PIECE_ON_VICE, e se
--      LOG.DESCR accetta NULL: VICE_trig concatena le colonne con cast(...),
--      un NULL rende NULL la descrizione e con LOG.DESCR NOT NULL la
--      migrazione si fermerebbe (annullata per intero);
--  10. (8/10) pallet con PIU' di una morsa (le viste prendono la morsa del
--      pallet: con due righe gli ordini si moltiplicherebbero);
--  11. (8/10) le definizioni di COORDINATES_PICKPLACE_MC (missione 16) e di
--      COORDINATES_FOR_PALLET_WAREHOUSE (letta dal PLC con select *);
--  12. (8/10) le viste con l'asterisco che leggono le tabelle toccate:
--      vice-jaw.sql rinfresca solo VICES.
--
-- COMANDO (cella, PowerShell, dalla cartella degli script dopo il git pull,
-- oppure dal ramo di revisione copiato in D:\Backup):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -s "|" -y 0 -i vice-jaw-controlli.sql -o D:\Backup\vice-jaw-controlli_esito.txt; Get-Content D:\Backup\vice-jaw-controlli_esito.txt
-- (-y 0 per le definizioni intere; -W e -y non vanno insieme, sqlcmd rifiuta)
-- ===========================================================================
SET NOCOUNT ON;

PRINT '== 1. MORSE: cosa diventa tipo di chele ==';
SELECT v.ID, RTRIM(v.FAMILY) AS FAMILY, v.STATUS, v.PALLET_ID,
	   v.CLAW_LENGTH, v.Z_CLAW, v.Z_SINK_CLAW,
	   CASE WHEN v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL THEN 'SI' ELSE 'no (nessuna misura)' END AS diventa_tipo,
	   CASE WHEN v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL
			THEN N'Chele attuali morsa ' + CAST(v.ID AS nvarchar(12)) END AS codice_tipo,
	   CASE WHEN v.CLAW_LENGTH = 0 OR v.Z_CLAW = 0 THEN 'zero -> NULL nel tipo (stesse quote)' ELSE '' END AS zeri,
	   CASE WHEN v.CLAW_LENGTH < 0 OR v.Z_CLAW < 0 OR v.Z_SINK_CLAW < 0 THEN 'NEGATIVO: la migrazione si ferma' ELSE '' END AS negativi
  FROM dbo.VICE v
 ORDER BY v.ID;

PRINT '== 2. BATTUTE (PIECE_ON_VICE) e tipo di chele con cui risultano dichiarate ==';
SELECT pv.VICE_ID, pv.PIECE_ID, RTRIM(p.FAMILY) AS PEZZO, p.Y AS PEZZO_Y, pv.STOP_BEYOND_CLAW, pv.COMP_PUSH,
	   CASE WHEN v.ID IS NULL THEN 'orfana (morsa assente)' ELSE '' END AS morsa,
	   CASE WHEN v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL
			THEN N'Chele attuali morsa ' + CAST(v.ID AS nvarchar(12)) ELSE N'(nessun tipo)' END AS tipo_riferimento_dopo,
	   CASE WHEN pv.STOP_BEYOND_CLAW = 0 THEN 'battuta a 0: col ritorno e chele montate piu'' lunghe diventerebbe negativa' ELSE '' END AS nota
  FROM dbo.PIECE_ON_VICE pv
  LEFT JOIN dbo.VICE v ON v.ID = pv.VICE_ID
  LEFT JOIN dbo.PIECE p ON p.ID = pv.PIECE_ID
 ORDER BY pv.VICE_ID, pv.PIECE_ID;

PRINT '== 3. ORDINI per stato ==';
SELECT w.STATUS, RTRIM(st.DESCR) AS STATO, COUNT(*) AS ordini
  FROM dbo.WORKORDER w LEFT JOIN dbo.[_STATUS_TYPE] st ON st.ID = w.STATUS
 GROUP BY w.STATUS, st.DESCR ORDER BY w.STATUS;

PRINT '== 4. ORDINI su pallet con una morsa SENZA misure (dopo la migrazione senza tipo: il Play verrebbe rifiutato) ==';
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

PRINT '== 7. VICE.ID e'' IDENTITY? (1 = si'') ==';
SELECT COLUMNPROPERTY(OBJECT_ID('dbo.VICE'), 'ID', 'IsIdentity') AS vice_id_identity;

PRINT '== 8. TIPI DELLE COLONNE DI VICE ==';
SELECT c.name, t.name AS tipo, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.VICE') ORDER BY c.column_id;

PRINT '== 9. TRIGGER sulle tabelle toccate, e LOG.DESCR accetta NULL? ==';
SELECT tr.name AS trigger_name, OBJECT_NAME(tr.parent_id) AS tabella, tr.is_disabled
  FROM sys.triggers tr
 WHERE OBJECT_NAME(tr.parent_id) IN (N'VICE', N'PALLET', N'WORKORDER', N'PIECE_ON_VICE')
 ORDER BY tabella, tr.name;
SELECT c.name AS colonna_log, t.name AS tipo, c.max_length, c.is_nullable AS accetta_null
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.log') AND c.name = N'DESCR';
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.VICE_trig')) AS VICE_trig;

PRINT '== 10. PALLET CON PIU'' DI UNA MORSA (atteso: nessuna riga) ==';
SELECT PALLET_ID, COUNT(*) AS morse FROM dbo.VICE WHERE PALLET_ID IS NOT NULL GROUP BY PALLET_ID HAVING COUNT(*) > 1;

PRINT '== 11. DEFINIZIONI di COORDINATES_PICKPLACE_MC e COORDINATES_FOR_PALLET_WAREHOUSE ==';
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PICKPLACE_MC')) AS COORDINATES_PICKPLACE_MC;
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_FOR_PALLET_WAREHOUSE')) AS COORDINATES_FOR_PALLET_WAREHOUSE;

PRINT '== 12. VISTE CON L''ASTERISCO che leggono VICE, WORKORDER, PIECE_ON_VICE o PALLET (vice-jaw.sql rinfresca solo VICES) ==';
SELECT DISTINCT OBJECT_NAME(d.referencing_id) AS vista, d.referenced_entity_name AS tabella
  FROM sys.sql_expression_dependencies d JOIN sys.views w ON w.object_id = d.referencing_id
 WHERE d.referenced_entity_name IN (N'VICE', N'WORKORDER', N'PIECE_ON_VICE', N'PALLET')
   AND OBJECT_DEFINITION(d.referencing_id) LIKE N'%*%'
 ORDER BY vista, tabella;
