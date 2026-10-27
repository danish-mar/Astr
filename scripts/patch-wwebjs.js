const fs = require('fs');
const path = require('path');

const authStorePath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'AuthStore', 'AuthStore.js');
if (fs.existsSync(authStorePath)) {
    let content = fs.readFileSync(authStorePath, 'utf8');
    const oldCode = "    window.AuthStore = {};\n    window.AuthStore.AppState = window.require('WAWebSocketModel').Socket;";
    const newCode = `    const wsModel = window.require('WAWebSocketModel');
    if (!wsModel || !wsModel.Socket) {
        throw new Error('window.require is not a function yet');
    }
    window.AuthStore = {};
    window.AuthStore.AppState = wsModel.Socket;`;
    if (content.includes(oldCode)) {
        content = content.replace(oldCode, newCode);
        fs.writeFileSync(authStorePath, content, 'utf8');
        console.log('[patch-wwebjs] Patched AuthStore.js');
    }
}

const clientPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');
if (fs.existsSync(clientPath)) {
    let clientContent = fs.readFileSync(clientPath, 'utf8');
    const targetCatch = "err.message.includes('require is not a function')\n                )) {";
    const patchedCatch = "err.message.includes('require is not a function') ||\n                    err.message.includes('Socket') ||\n                    err.message.includes('reading \\'Socket\\'')\n                )) {";
    if (clientContent.includes(targetCatch)) {
        clientContent = clientContent.replace(targetCatch, patchedCatch);
        fs.writeFileSync(clientPath, clientContent, 'utf8');
        console.log('[patch-wwebjs] Patched Client.js retry conditions');
    }
}
