const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('path');

const { pathToFileURL } = require('node:url');
const dist = path.resolve(__dirname, '..', 'dist');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'opencircuit',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'OpenCircuit EDA 3',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('opencircuit://workspace/index.html');
}

app.whenReady().then(() => {
  protocol.handle('opencircuit', (request) => {
    const url = new URL(request.url);
    const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(dist, file);
    if (
      url.hostname !== 'workspace' ||
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    )
      return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
