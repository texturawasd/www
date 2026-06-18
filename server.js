const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const WWW_DIR = __dirname;

// Helper function to get the next available filename in saved directory
function getNextFilename() {
    const savedDir = path.join(WWW_DIR, 'chat', 'saved');
    if (!fs.existsSync(savedDir)) {
        fs.mkdirSync(savedDir, { recursive: true });
    }

    let counter = 1;
    while (fs.existsSync(path.join(savedDir, `${counter}.md`))) {
        counter++;
    }
    return `${counter}.md`;
}

// Helper function to format the saved content
function formatSaveContent(prompt, answer) {
    const timestamp = new Date().toISOString();
    return `# Prompt\n\n${prompt}\n\n# Answer\n\n${answer}\n\n---\n*Saved at: ${timestamp}*\n`;
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle save endpoint
    if (req.url === '/chat/api/save' && req.method === 'POST') {
        console.log("Save endpoint called");
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                console.log("Received body:", body);
                const data = JSON.parse(body);
                const { prompt, answer } = data;

                console.log("Prompt length:", prompt?.length, "Answer length:", answer?.length);

                if (!prompt || !answer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing prompt or answer' }));
                    return;
                }

                const filename = getNextFilename();
                const filepath = path.join(WWW_DIR, 'chat', 'saved', filename);
                const content = formatSaveContent(prompt, answer);

                fs.writeFileSync(filepath, content, 'utf8');
                console.log("File saved to:", filepath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    file: filename,
                    path: `/chat/saved/${filename}`
                }));
            } catch (e) {
                console.error('Error saving file:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save file' }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = path.join(WWW_DIR, req.url === '/' ? '/index.html' : req.url);

    // Prevent directory traversal
    if (!path.resolve(filePath).startsWith(WWW_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            const ext = path.extname(filePath);
            const contentTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.md': 'text/markdown',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml'
            };

            const contentType = contentTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
