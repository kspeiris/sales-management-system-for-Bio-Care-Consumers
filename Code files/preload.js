const { contextBridge, ipcRenderer } = require('electron');

// Expose database API to React
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls - Changed to use ipcRenderer.send instead of invoke
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Database operations
  db: {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    select: (sql, params) => ipcRenderer.invoke('db-select', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db-get', sql, params),
    backup: () => ipcRenderer.invoke('db-backup'),
    transaction: (callback) => ipcRenderer.invoke('db-transaction', callback)
  },

  // Event listeners for window state
  on: (channel, callback) => {
    const validChannels = ['window-maximized', 'window-restored'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  removeAllListeners: (channel) => {
    const validChannels = ['window-maximized', 'window-restored'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Backup database listener with cleanup
  onBackupDatabase: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('backup-database', subscription);

    return () => {
      ipcRenderer.removeListener('backup-database', subscription);
    };
  },

  // Error logging
  logError: (error) => ipcRenderer.send('log-error', error)
});