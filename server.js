const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'characters.json');
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, message) {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(message);
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('La petición es demasiado grande.'));
                request.destroy();
            }
        });
        request.on('end', () => resolve(body));
        request.on('error', reject);
    });
}

function normalizeCharactersPayload(payload) {
    if (!payload || !Array.isArray(payload.characters)) {
        throw new Error('El cuerpo debe incluir un arreglo "characters".');
    }

    return payload.characters.map(character => ({
        id: String(character.id || '').trim(),
        name: String(character.name || '').trim(),
        birthDate: String(character.birthDate || '').trim(),
        country: String(character.country || '').trim(),
        city: String(character.city || '').trim(),
        height: String(character.height || '').trim(),
        photo: String(character.photo || '').trim(),
        group: String(character.group || 'cantantes').trim(),
        ...(character.createdAt ? { createdAt: String(character.createdAt) } : {}),
    })).filter(character => character.id && character.name);
}

async function handleCharactersApi(request, response) {
    if (request.method === 'GET') {
        const content = await fs.readFile(DATA_FILE, 'utf8');
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(content);
        return;
    }

    if (request.method !== 'PUT') {
        sendText(response, 405, 'Método no permitido. Usa GET o PUT.');
        return;
    }

    const body = await readBody(request);
    const payload = JSON.parse(body || '{}');
    const characters = normalizeCharactersPayload(payload);
    const nextData = JSON.stringify({ characters }, null, 2) + '\n';
    const tempFile = `${DATA_FILE}.tmp`;

    await fs.writeFile(tempFile, nextData, 'utf8');
    await fs.rename(tempFile, DATA_FILE);
    sendJson(response, 200, { ok: true, total: characters.length });
}

async function serveStatic(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    const filePath = path.normalize(path.join(ROOT_DIR, pathname));

    if (!filePath.startsWith(ROOT_DIR)) {
        sendText(response, 403, 'Ruta no permitida.');
        return;
    }

    try {
        const file = await fs.readFile(filePath);
        response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
        response.end(file);
    } catch (error) {
        if (error.code === 'ENOENT') {
            sendText(response, 404, 'Archivo no encontrado.');
            return;
        }
        throw error;
    }
}

const server = http.createServer(async (request, response) => {
    try {
        if (request.url.startsWith('/api/characters')) {
            await handleCharactersApi(request, response);
            return;
        }
        await serveStatic(request, response);
    } catch (error) {
        console.error(error);
        sendText(response, 500, error.message || 'Error interno del servidor.');
    }
});

server.listen(PORT, () => {
    console.log(`SuperEliteG2 listo en http://localhost:${PORT}`);
    console.log('Los cambios de personajes se guardarán automáticamente en characters.json.');
});
