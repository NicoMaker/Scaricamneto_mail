const http = require("http");
const fs = require("fs");
const path = require("path");
const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const archiver = require("archiver");
const mime = require("mime-types");

const PORT = 3000;

function parseFormData(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const data = {};
    body.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      data[decodeURIComponent(key)] = decodeURIComponent(
        value.replace(/\+/g, " "),
      );
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
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");
    const messages = await connection.search(["ALL"], {
      bodies: [""],
      struct: true,
    });

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);

    let count = 1;
    for (const msg of messages) {
      const all = msg.parts.find((p) => p.which === "");
      const parsed = await simpleParser(all.body);

      const dir = path.join(__dirname, `email_${count}`);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(path.join(dir, "message.eml"), all.body);

      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          const filePath = path.join(
            dir,
            att.filename || `allegato_${Date.now()}`,
          );
          fs.writeFileSync(filePath, att.content);
        }
      }

      archive.directory(dir, `email_${count}`);
      count++;
    }

    archive.finalize();

    output.on("close", () => {
      for (let i = 1; i < count; i++) {
        const dir = path.join(__dirname, `email_${i}`);
        fs.rmSync(dir, { recursive: true, force: true });
      }
      connection.end();
      cb(null);
    });

    archive.on("error", (err) => cb(err));
  } catch (err) {
    cb(err);
  }
}

const server = http.createServer((req, res) => {
  const serveStatic = (filePath) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("File non trovato");
      }
      res.writeHead(200, {
        "Content-Type":
          mime.contentType(filePath) || "application/octet-stream",
      });
      res.end(data);
    });
  };

  if (req.method === "GET" && req.url === "/") {
    serveStatic(path.join(__dirname, "../frontend", "index.html"));
  } else if (req.method === "GET") {
    const filePath = path.join(__dirname, "../frontend", req.url);
    fs.exists(filePath, (exists) => {
      if (exists) {
        serveStatic(filePath);
      } else if (req.url === "/download") {
        const zipPath = path.join(__dirname, "backup.zip");
        fs.readFile(zipPath, (err, data) => {
          if (err) {
            res.writeHead(404);
            return res.end("<h2>File non trovato</h2>");
          }
          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition": "attachment; filename=backup.zip",
          });
          res.end(data);
        });
      } else {
        res.writeHead(404);
        res.end("<h2>404 - Pagina non trovata</h2>");
      }
    });
  } else if (req.method === "POST" && req.url === "/backup") {
    parseFormData(req, (form) => {
      const zipPath = path.join(__dirname, "backup.zip");
      downloadEmails(form, zipPath, (err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          return res.end("<h2>Errore nel backup: " + err.message + "</h2>");
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html lang="it">
            <head>
              <meta charset="UTF-8">
              <title>Backup Terminato</title>
              <link rel="stylesheet" href="/style.css">
              <style>
                .success-box {
                  max-width: 500px;
                  margin: 100px auto;
                  padding: 30px;
                  background: #e8f5e9;
                  border: 2px solid #4caf50;
                  border-radius: 10px;
                  text-align: center;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .success-box h1 {
                  color: #2e7d32;
                }
                .success-box .btn {
                  background-color: #4caf50;
                }
                .success-box .btn:hover {
                  background-color: #388e3c;
                }
              </style>
            </head>
            <body>
              <div class="success-box">
                <h1>✅ Backup Terminato</h1>
                <p>Il tuo file è pronto. Clicca per scaricare il backup ZIP:</p>
                <a href="/download" class="btn">⬇️ Scarica il backup ZIP</a>
              </div>
            </body>
          </html>
        `);
      });
    });
  } else {
    res.writeHead(404);
    res.end("<h2>404 - Pagina non trovata</h2>");
  }
});

server.listen(PORT, () => {
  console.log(`✅ Server attivo su http://localhost:${PORT}`);
});
