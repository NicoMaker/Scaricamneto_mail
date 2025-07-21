const http = require('http');
const fs = require('fs');
const path = require('path');

// Moduli esterni (da installare): imap-simple, archiver
const imaps = require('imap-simple');
const archiver = require('archiver');

const PORT = 3000;
const HTML_PATH = path.join(__dirname, 'index.html');

function parseFormData(req, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        const data = {};
        body.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            data[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
        });
        callback(data);
    });
}

async function downloadEmails({ email, password, imap_server }, zipPath, cb) {
    const config = {
        imap: {
            user: email,
            password: password,
            host: imap_server,
            port: 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false } // Accetta certificati self-signed
        }
    };
    let emlFiles = [];
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        const searchCriteria = ["ALL"];
        const fetchOptions = { bodies: [''], struct: true };
        const messages = await connection.search(searchCriteria, fetchOptions);
        for (let i = 0; i < messages.length; i++) {
            const all = messages[i].parts.find(part => part.which === '');
            const eml = all.body;
            const emlPath = path.join(__dirname, `email_${i+1}.eml`);
            fs.writeFileSync(emlPath, eml);
            emlFiles.push(emlPath);
        }
        // Crea lo zip con i file .eml nella radice
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', function() {
            // Elimina i file .eml dalla radice
            for (const file of emlFiles) {
                try { fs.unlinkSync(file); } catch (e) {}
            }
            cb(null);
        });
        archive.on('error', function(err) { cb(err); });
        archive.pipe(output);
        for (const file of emlFiles) {
            archive.file(file, { name: path.basename(file) });
        }
        archive.finalize();
        connection.end();
    } catch (err) {
        cb(err);
    }
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        fs.readFile(HTML_PATH, (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.method === 'POST' && req.url === '/backup') {
        parseFormData(req, (form) => {
            const zipPath = path.join(__dirname, 'backup.zip');
            downloadEmails(form, zipPath, (err) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<h2>Errore durante il backup: ' + (err.message || err) + '</h2>');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h2>Backup completato!</h2><a href="/download">Scarica il file ZIP</a>');
                }
            });
        });
    } else if (req.method === 'GET' && req.url === '/download') {
        const zipPath = path.join(__dirname, 'backup.zip');
        fs.readFile(zipPath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h2>File non trovato</h2>');
            } else {
                res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': 'attachment; filename="backup.zip"'
                });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h2>Pagina non trovata</h2>');
    }
});

server.listen(PORT, () => {
    console.log('Server avviato su http://localhost:' + PORT);
}); 