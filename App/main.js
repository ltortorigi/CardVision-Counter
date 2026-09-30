const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const appIcon = path.join(__dirname, 'assets', process.platform === 'darwin' ? 'mac_chip.png' : 'windows_chip.png');
const { createWorker } = require('tesseract.js');

let workersPromise = null;

async function createOcrWorkers() {
  if (!workersPromise) {
    workersPromise = Promise.all([0, 1].map(async () => {
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789AJQK',
        tessedit_pageseg_mode: '13'
      });
      return worker;
    }));
  }
  return workersPromise;
}

async function recognizeRanks(items) {
  const workers = await createOcrWorkers();
  const buckets = workers.map(() => []);

  items.forEach((item, index) => {
    buckets[index % workers.length].push(item);
  });

  const groups = await Promise.all(buckets.map(async (bucket, workerIndex) => {
    const worker = workers[workerIndex];
    const output = [];

    for (const item of bucket) {
      try {
        const result = await worker.recognize(item.dataUrl);
        output.push({
          id: item.id,
          text: String(result?.data?.text || '').trim().toUpperCase(),
          confidence: Number(result?.data?.confidence || 0),
          holes: Number(item.holes || 0)
        });
      } catch (error) {
        output.push({
          id: item.id,
          text: '',
          confidence: 0,
          holes: Number(item.holes || 0),
          error: String(error?.message || error)
        });
      }
    }

    return output;
  }));

  return groups.flat();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#07130f',
    icon: appIcon,
    title: 'CardVision Counter',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

ipcMain.handle('desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  });

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.handle('warm-ocr', async () => {
  await createOcrWorkers();
  return { ready: true };
});

ipcMain.handle('ocr-ranks', async (_event, items) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  return recognizeRanks(items.slice(0, 30));
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(appIcon);
  }
  createWindow();
});

app.on('window-all-closed', async () => {
  if (workersPromise) {
    try {
      const workers = await workersPromise;
      await Promise.all(workers.map(worker => worker.terminate()));
    } catch {}
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
