// Google Drive & Docs integration
// Uses Google Identity Services (OAuth 2.0) + Drive/Docs REST API

const Drive = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID', // Set via config.js or env
  API_KEY: 'YOUR_GOOGLE_API_KEY',
  SCOPES: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents',
  BASE_FOLDER_ID: '1iXQQolBCGsCA4xrpzaCy70YW53i2FyB1', // Provided by user
  TEMPLATE_ID: null, // Set after template is created

  token: null,

  // ── Auth ──
  async signIn() {
    return new Promise((resolve, reject) => {
      if (!window.google) { reject(new Error('Google SDK not loaded')); return; }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: Drive.CLIENT_ID,
        scope: Drive.SCOPES,
        callback: (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          Drive.token = resp.access_token;
          localStorage.setItem('fortx_gtoken', resp.access_token);
          resolve(resp);
        }
      });
      client.requestAccessToken();
    });
  },

  async signOut() {
    if (Drive.token) google.accounts.oauth2.revoke(Drive.token);
    Drive.token = null;
    localStorage.removeItem('fortx_gtoken');
  },

  // ── API helpers ──
  async api(method, url, body = null, isBlob = false) {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${Drive.token}` }
    };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    return isBlob ? res.blob() : res.json();
  },

  // ── Folder management ──
  async createFolder(name, parentId = Drive.BASE_FOLDER_ID) {
    return Drive.api('POST', 'https://www.googleapis.com/drive/v3/files', {
      name, mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    });
  },

  async findFolder(name, parentId = Drive.BASE_FOLDER_ID) {
    const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await Drive.api('GET', `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    return res.files?.[0] || null;
  },

  async getOrCreateFolder(name, parentId = Drive.BASE_FOLDER_ID) {
    const existing = await Drive.findFolder(name, parentId);
    return existing || await Drive.createFolder(name, parentId);
  },

  // ── Template copy ──
  async copyTemplate(templateId, newName, folderId) {
    return Drive.api('POST', `https://www.googleapis.com/drive/v3/files/${templateId}/copy`, {
      name: newName, parents: [folderId]
    });
  },

  // ── Upload image to Drive ──
  async uploadImage(base64Data, fileName, folderId) {
    const byteStr = atob(base64Data.split(',')[1]);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/jpeg' });

    const metadata = { name: fileName, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Drive.token}` },
      body: form
    });
    return res.json();
  },

  // ── Google Docs manipulation ──
  async batchUpdateDoc(docId, requests) {
    return Drive.api('POST', `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, { requests });
  },

  async getDoc(docId) {
    return Drive.api('GET', `https://docs.googleapis.com/v1/documents/${docId}`);
  },

  // Replace {{PLACEHOLDER}} text in doc
  async replacePlaceholders(docId, replacements) {
    const requests = Object.entries(replacements).map(([key, value]) => ({
      replaceAllText: {
        containsText: { text: `{{${key}}}`, matchCase: true },
        replaceText: value || ''
      }
    }));
    return Drive.batchUpdateDoc(docId, requests);
  },

  // Insert image into doc at a named bookmark/placeholder
  async insertImageAtPlaceholder(docId, imageUrl, width = 400) {
    // Images are inserted at the end of the doc (simplest approach for now)
    // For template-based insertion, use named ranges
    const requests = [{
      insertInlineImage: {
        uri: imageUrl,
        objectSize: {
          height: { magnitude: Math.round(width * 0.75), unit: 'PT' },
          width: { magnitude: width, unit: 'PT' }
        },
        location: { index: 1 }
      }
    }];
    return Drive.batchUpdateDoc(docId, requests);
  },

  // Export doc as PDF blob
  async exportAsPDF(docId) {
    return Drive.api('GET',
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`,
      null, true
    );
  },

  // Make file publicly viewable (for sharing link)
  async makePublic(fileId) {
    return Drive.api('POST', `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      role: 'reader', type: 'anyone'
    });
  }
};

window.Drive = Drive;
