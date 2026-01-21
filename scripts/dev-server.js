// Lightweight local dev server to emulate absolute routes
// No external deps needed. Run with: node scripts/dev-server.js

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

/* ------------------------------------------------------------------ */
/* ESM __dirname replacement                                          */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DEVICE_HOST = process.env.DEVICE_HOST || '192.168.178.53';
// const ROOT = path.resolve(__dirname, '../data');
const ROOT = path.resolve(__dirname, '../dist');

const routes = {
    '/': 'index.html',
    '/game': 'game.html',
    '/settings': 'settings.html',
    '/debug': 'debug.html',
    '/captivePortal': 'captivePortal.html',
};

const mime = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=UTF-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function safeJoin(base, target) {
    const resolved = path.resolve(base, target);
    return resolved.startsWith(base) ? resolved : null;
}

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500, {
                'Content-Type': 'text/plain',
            });
            res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
            return;
        }

        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
    });
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');
}

function proxyRequest(req, res, targetUrl) {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const parsedUrl = new URL(targetUrl);

    const proxyReq = protocol.request(
        {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: req.method,
            headers: {
                ...req.headers,
                host: parsedUrl.hostname,
            },
        },
        (proxyRes) => {
            setCorsHeaders(res);
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }
    );

    proxyReq.on('error', (err) => {
        console.error('[proxy] Error:', err.message);
        setCorsHeaders(res);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                error: 'Proxy request failed',
                details: err.message,
            })
        );
    });

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURI(parsed.pathname || '/');

    // Log all requests
    const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
    console.log(`[${timestamp}] ${req.method.padEnd(6)} ${req.url}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(200);
        return res.end();
    }

    // Proxy API calls to the device
    if (pathname.startsWith('/api/')) {
        const targetUrl = `http://${DEVICE_HOST}${pathname}${parsed.search || ''}`;
        console.log(`[proxy] ${req.method} ${pathname} → ${targetUrl}`);
        return proxyRequest(req, res, targetUrl);
    }

    // Explicit route-to-file mappings
    if (routes[pathname]) {
        const filePath = safeJoin(ROOT, routes[pathname]);
        return filePath
            ? serveFile(res, filePath)
            : res.writeHead(403).end('Forbidden');
    }

    // Serve assets under /assets
    if (pathname.startsWith('/assets/')) {
        const assetPath = pathname.replace('/assets/', 'assets/');
        const filePath = safeJoin(ROOT, assetPath);
        return filePath
            ? serveFile(res, filePath)
            : res.writeHead(404).end('Not Found');
    }

    // Direct file access
    const directFile = safeJoin(ROOT, pathname.replace(/^\//, ''));
    if (
        directFile &&
        fs.existsSync(directFile) &&
        fs.statSync(directFile).isFile()
    ) {
        return serveFile(res, directFile);
    }

    // Fallback
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */

server.listen(PORT, () => {
    console.log(`[dev-server] Listening on http://localhost:${PORT}`);
    console.log(`[dev-server] ROOT: ${ROOT}`);
    console.log(`[dev-server] Proxying /api/* to http://${DEVICE_HOST}`);
    console.log('[dev-server] Routes: /, /game, /settings, /debug, /captivePortal');
    console.log(
        `[dev-server] Set DEVICE_HOST env var to change device address (default: ${DEVICE_HOST})`
    );
});
