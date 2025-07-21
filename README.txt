# Backup Email - Istruzioni

1. Installa Node.js (se non già presente).
2. Installa le dipendenze necessarie:
   npm install imap-simple archiver
3. Avvia il server:
   node server.js
4. Apri il browser su http://localhost:3000
5. Inserisci i dati della tua email e scarica il backup ZIP.

Nota: Per Gmail potrebbe essere necessario generare una password per app nelle impostazioni di sicurezza Google.

Tutti i file .eml e il backup.zip saranno creati nella cartella principale del progetto. 