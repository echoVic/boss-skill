import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface UiDesignPreviewServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export async function startUiDesignPreviewServer(html: string, port = 0): Promise<UiDesignPreviewServer> {
  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://localhost:${address.port}`;

  return {
    server,
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      })
  };
}
