import { spawn } from 'node:child_process';
export function createOpenUrl(spawnProcess, platform) {
    return (url) => {
        const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
        const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
        try {
            const child = spawnProcess(command, args, { detached: true, stdio: 'ignore' });
            child.on('error', () => {
                // The boolean API can only report synchronous spawn failures.
            });
            child.unref();
            return true;
        }
        catch {
            return false;
        }
    };
}
export function openUrl(url) {
    return createOpenUrl(spawn, process.platform)(url);
}
