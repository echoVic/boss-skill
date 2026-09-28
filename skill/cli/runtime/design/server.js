import { createServer } from 'node:http';
export async function startUiDesignPreviewServer(html, port = 0) {
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (url.pathname === '/healthz') {
            response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ ok: true }));
            return;
        }
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html);
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address();
    const url = `http://localhost:${address.port}`;
    let closed = false;
    return {
        server,
        url,
        close: () => {
            if (closed)
                return Promise.resolve();
            closed = true;
            return new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
            });
        },
    };
}
