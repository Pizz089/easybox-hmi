-- ===========================================================================
-- tray-teaching.sql — cantiere tray-teaching (comando "0 CASSETTIERA")
--
-- SCOPO: teaching origine per-cassetto dal pannello. La quota del piano vive
-- in TRAY.X_CORR/Y_CORR/Z_CORR (gia' esistenti); qui si aggiungono le colonne
-- di teaching mancanti:
--   X_ROT/Y_ROT/Z_ROT           rotazioni di presa (millesimi di grado),
--                               uniformi per cassettiera, propagate alle
--                               [POSITION] TRAY_n dal pannello;
--   APPROACH_X/APPROACH_Y/APPROACH_Z  avvicinamenti (millesimi di mm),
--                               per-cassetto, propagati alle [POSITION].
--
-- NULL = "mai insegnato": insertPositionTray fa COALESCE coi default storici
-- (rot 0, approach 100000; APPROACH_TYPE resta la colonna esistente, default
-- 3) — comportamento attuale al byte finche' non si fa teaching.
--
-- NB VISTA: TRAYS e' "SELECT T.*" NON schemabound — le colonne nuove NON
-- appaiono nella vista finche' non si esegue sp_refreshview (sotto).
--
-- IDEMPOTENTE: riesegui quando vuoi (guardie COL_LENGTH).
--
-- IN CELLA (login plc SENZA permessi ALTER — DDL manuale, nota APPUNTI-CELLA):
--   sqlcmd -S 172.20.70.80\SQLEXPRESS -E -d ADMG -i tray-teaching.sql
-- ===========================================================================

IF COL_LENGTH('dbo.TRAY','X_ROT') IS NULL
    ALTER TABLE dbo.TRAY ADD X_ROT int NULL;
IF COL_LENGTH('dbo.TRAY','Y_ROT') IS NULL
    ALTER TABLE dbo.TRAY ADD Y_ROT int NULL;
IF COL_LENGTH('dbo.TRAY','Z_ROT') IS NULL
    ALTER TABLE dbo.TRAY ADD Z_ROT int NULL;
IF COL_LENGTH('dbo.TRAY','APPROACH_X') IS NULL
    ALTER TABLE dbo.TRAY ADD APPROACH_X int NULL;
IF COL_LENGTH('dbo.TRAY','APPROACH_Y') IS NULL
    ALTER TABLE dbo.TRAY ADD APPROACH_Y int NULL;
IF COL_LENGTH('dbo.TRAY','APPROACH_Z') IS NULL
    ALTER TABLE dbo.TRAY ADD APPROACH_Z int NULL;
GO

-- la vista TRAYS (SELECT T.*) e' congelata alle colonne della CREATE:
-- senza refresh, tray/show/all non esporrebbe le colonne nuove.
EXEC sp_refreshview 'TRAYS';
GO

-- verifica (attese 6 righe):
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME='TRAY'
   AND COLUMN_NAME IN ('X_ROT','Y_ROT','Z_ROT','APPROACH_X','APPROACH_Y','APPROACH_Z');
GO

-- ===========================================================================
-- ROLLBACK (manuale, commentato — esegui solo per tornare indietro):
-- ALTER TABLE dbo.TRAY DROP COLUMN X_ROT, Y_ROT, Z_ROT,
--                                  APPROACH_X, APPROACH_Y, APPROACH_Z;
-- EXEC sp_refreshview 'TRAYS';
-- ===========================================================================
