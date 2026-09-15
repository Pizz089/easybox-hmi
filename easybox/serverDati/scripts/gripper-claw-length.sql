-- ===========================================================================
-- gripper-claw-length.sql — colonna GRIPPER.CLAW_LENGTH (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9)
--
-- SCOPO: LUNGHEZZA della chela della pinza, in MICRON. Dimensione FISICA, si
-- misura col calibro. Serve alla quota di spinta: il TCP sta al centro della
-- chela e il punto che tocca il pezzo e' il bordo, quindi si compensa MEZZA
-- lunghezza.
--
-- PERCHE' UNA COLONNA NUOVA: in GRIPPER non c'era. X_BODY/Y_BODY/Z_BODY e
-- X_CLAW/Y_CLAW/Z_CLAW NON sono lunghezze ma le componenti dell'offset del
-- punto di presa rispetto alla flangia (il PLC le somma: X_BODY+X_CLAW eccetera);
-- sulla pinza doppia in cella Y_CLAW vale 0. Stroke_CLAW e Tickness_CLAW sono
-- corsa e spessore. Della lunghezza non c'era traccia.
--
-- GEOMETRIA: le chele della pinza si aprono lungo la Y del robot (stringono
-- di traverso rispetto alla spinta), quindi la chela presenta la sua LUNGHEZZA
-- nella direzione in cui spinge. La prima stesura usava lo SPESSORE: era
-- conseguenza dell'asse sbagliato (spinta creduta sulla Y).
--
-- NULL = non misurata: il ciclo di spinta NON si abilita e l'ordine viene
-- rifiutato con KO_PUSH_NO_DATA. Le pinze esistenti restano com'erano.
--
-- IDEMPOTENTE. ORDINE DI DEPLOY: PRIMA del backend.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i gripper-claw-length.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.GRIPPER', 'CLAW_LENGTH') IS NOT NULL
	PRINT 'GRIPPER.CLAW_LENGTH gia'' presente: niente da fare.';
ELSE BEGIN
	ALTER TABLE dbo.GRIPPER ADD CLAW_LENGTH int NULL;
	PRINT 'GRIPPER.CLAW_LENGTH aggiunta (int NULL, micron; NULL = non misurata).';
END
GO

-- La vista GRIPPERS elenca le colonne per nome, quindi NON vede da sola la
-- colonna nuova: va estesa. (Diversa da VICES, che usa SELECT v.* e si
-- aggiorna con sp_refreshview.)
IF COL_LENGTH('dbo.GRIPPER', 'CLAW_LENGTH') IS NOT NULL
   AND OBJECT_DEFINITION(OBJECT_ID('dbo.GRIPPERS')) NOT LIKE '%CLAW_LENGTH,%'
   AND OBJECT_DEFINITION(OBJECT_ID('dbo.GRIPPERS')) NOT LIKE '%G.CLAW_LENGTH%'
BEGIN
	EXEC('ALTER VIEW dbo.GRIPPERS AS
SELECT 	G.ID,rtrim(G.FAMILY) as FAMILY, rtrim(G.DESCR) as DESCR,
		G.X_BODY, G.Y_BODY,G.Z_BODY,
		G.X_CLAW ,G.Y_CLAW ,G.Z_CLAW ,
		G.STATUS, ST.DESCR AS STATUS_DESC, G.SUB_POS, G.POS_MAG,G.POS_PLANT,G.STROKE_CLAW,G.TICKNESS_CLAW
		,G.CLAW_LENGTH
		,gt.Valve3*100+gt.valve2*10+gt.Valve1 as VALVES,
		g.X_ROT, g.Y_ROT, g.Z_ROT
FROM GRIPPER G, [_STATUS_TYPE] ST , [_Gripper_Type] gt
WHERE G.STATUS =ST.ID and g.FAMILY =gt.[TYPE]');
	PRINT 'vista GRIPPERS estesa con CLAW_LENGTH (ogni altra colonna invariata).';
END
ELSE
	PRINT 'vista GRIPPERS: niente da fare.';

-- verifica:
-- SELECT ID, RTRIM(FAMILY) AS FAMILY, Stroke_CLAW, Tickness_CLAW, CLAW_LENGTH FROM GRIPPER;

-- ===========================================================================
-- ROLLBACK (manuale): rimettere la vista GRIPPERS senza CLAW_LENGTH e poi
-- ALTER TABLE dbo.GRIPPER DROP COLUMN CLAW_LENGTH;
-- ===========================================================================
