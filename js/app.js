'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const STATE_KEY = 'fortx_visit_state_v2';

const defaultState = () => ({
  visit: {
    project: '', location: '', date: '', time: '',
    preparedBy: '', client: '', notes: '', coverPhoto: null
  },
  cameras: [],
  currentPage: 'project',
  lastSaved: null
});

let state = defaultState();

// ── Persistence ─────────────────────────────────────────────────────────────
function saveState() {
  try {
    state.lastSaved = new Date().toISOString();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    showSaveIndicator();
  } catch (e) {
    // Storage full? Try clearing old keys
    console.warn('Save failed, clearing old data:', e);
    try {
      // Remove old version key if present
      localStorage.removeItem('fortx_visit_state');
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch(e2) { console.error('Save failed completely', e2); }
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge — keep defaults for any missing keys
      state = {
        ...defaultState(),
        ...parsed,
        visit: { ...defaultState().visit, ...(parsed.visit || {}) }
      };
      return true; // had saved state
    }
  } catch (e) {
    console.warn('Load state failed, starting fresh:', e);
    localStorage.removeItem(STATE_KEY);
  }
  return false;
}

// Schedule save 600ms after last change (debounce)
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 600);
}

// ── UI Helpers ───────────────────────────────────────────────────────────────
function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  const ts = document.getElementById('save-time');
  if (ts) {
    const now = new Date();
    ts.textContent = now.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3000);
}

function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 2800);
}

function showOverlay(msg = 'Processing…') {
  const o = document.getElementById('overlay');
  if (o) { o.querySelector('.overlay-msg').textContent = msg; o.classList.add('show'); }
}
function hideOverlay() { document.getElementById('overlay')?.classList.remove('show'); }

window.showToast = showToast;
window.showOverlay = showOverlay;
window.hideOverlay = hideOverlay;
window.state = state; // expose for badge updater

// ── Navigation ───────────────────────────────────────────────────────────────
const pageLabels = {
  project: 'Project Info',
  cameras: 'Camera Locations',
  preview: 'Preview',
  complete: 'Export Report'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.page === pageId)
  );
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = pageLabels[pageId] || '';
  state.currentPage = pageId;
  saveState();

  if (pageId === 'cameras') renderCameraList();
  if (pageId === 'preview') renderPreview();

  // Scroll to top
  window.scrollTo(0, 0);
}
window.navigateTo = navigateTo;

// ── Auth ──────────────────────────────────────────────────────────────────────
async function handleSignIn() {
  try {
    showOverlay('Signing in with Google…');
    await Drive.signIn();
    hideOverlay();
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    showToast('Signed in successfully', 'success');
  } catch (err) {
    hideOverlay();
    showToast('Sign-in failed: ' + err.message, 'error');
  }
}

function handleSignOut() {
  Drive.signOut();
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ── Project Page ──────────────────────────────────────────────────────────────
function initProjectPage() {
  const fields = ['project', 'location', 'date', 'time', 'preparedBy', 'client', 'notes'];

  fields.forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (!el) return;
    // Restore saved value
    if (state.visit[f]) el.value = state.visit[f];
    el.addEventListener('input', () => {
      state.visit[f] = el.value;
      scheduleSave();
    });
  });

  // Auto-set date/time only if not already saved
  if (!state.visit.date) {
    const now = new Date();
    const dateEl = document.getElementById('field-date');
    const timeEl = document.getElementById('field-time');
    if (dateEl) {
      dateEl.value = now.toISOString().split('T')[0];
      state.visit.date = dateEl.value;
    }
    if (timeEl) {
      timeEl.value = now.toTimeString().slice(0, 5);
      state.visit.time = timeEl.value;
    }
    scheduleSave();
  }

  // Cover photo
  const coverZone  = document.getElementById('cover-photo-zone');
  const coverInput = document.getElementById('cover-photo-input');
  if (coverZone && coverInput) {
    if (state.visit.coverPhoto) {
      Camera.showPreview(coverZone, state.visit.coverPhoto);
    }
    Camera.bind(coverZone, coverInput, (b64) => {
      state.visit.coverPhoto = b64;
      scheduleSave();
    });
  }

  document.getElementById('btn-next-cameras')?.addEventListener('click', () => {
    if (!state.visit.project.trim()) { showToast('Please enter a project name', 'error'); return; }
    if (!state.visit.location.trim()) { showToast('Please enter a location', 'error'); return; }
    navigateTo('cameras');
  });
}

// ── Camera List ───────────────────────────────────────────────────────────────
function renderCameraList() {
  const list  = document.getElementById('camera-list');
  const badge = document.getElementById('cam-badge');
  if (badge) {
    badge.textContent = state.cameras.length || '';
    badge.style.display = state.cameras.length ? 'flex' : 'none';
  }
  if (!list) return;

  if (state.cameras.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
      <p>No camera locations yet.<br>Tap <strong>Add Camera</strong> to begin.</p>
    </div>`;
    return;
  }

  list.innerHTML = state.cameras.map((cam, i) => `
    <div class="cam-entry">
      <div class="cam-entry-header">
        <span class="cam-entry-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:5px">
            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
          ${cam.number || `CAM-${i + 1}`}
        </span>
        <div style="display:flex;gap:6px;align-items:center">
          ${cam.installPhoto && cam.viewPhoto
            ? '<span class="chip chip-green" style="font-size:0.6rem">✓ Complete</span>'
            : '<span class="chip chip-blue" style="font-size:0.6rem">⚠ Photos pending</span>'
          }
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:0.75rem" onclick="editCamera(${i})">Edit</button>
          <button class="btn btn-danger"    style="padding:5px 12px;font-size:0.75rem" onclick="deleteCamera(${i})">✕</button>
        </div>
      </div>
      <div class="cam-entry-body">
        <p style="font-size:0.82rem;color:var(--slate-400);line-height:1.5">${cam.description || '<em style="opacity:0.5">No description</em>'}</p>
        <div class="cam-photos">
          ${photoThumb(cam.installPhoto, 'Install Point')}
          ${photoThumb(cam.viewPhoto,    'Field of View')}
        </div>
        ${cam.savedAt ? `<p style="font-size:0.65rem;color:var(--slate-400);margin-top:4px;text-align:right">Saved ${new Date(cam.savedAt).toLocaleTimeString('en-SG')}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function photoThumb(src, label) {
  if (src) return `
    <div style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:4/3">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover">
      <span style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));font-size:0.6rem;color:#fff;padding:12px 6px 4px;text-align:center">${label}</span>
    </div>`;
  return `
    <div style="aspect-ratio:4/3;background:var(--navy-700);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
      </svg>
      <span style="font-size:0.6rem;color:var(--slate-400);opacity:0.6">${label}</span>
    </div>`;
}

window.editCamera = function(idx) {
  openCameraModal(idx);
};

window.deleteCamera = function(idx) {
  const name = state.cameras[idx]?.number || `CAM-${idx + 1}`;
  if (!confirm(`Delete ${name}?`)) return;
  state.cameras.splice(idx, 1);
  saveState();
  renderCameraList();
  showToast('Camera removed');
};

// ── Camera Modal ──────────────────────────────────────────────────────────────
function openCameraModal(editIdx = null) {
  const modal    = document.getElementById('camera-modal');
  const existing = editIdx !== null ? state.cameras[editIdx] : null;

  document.getElementById('cam-number').value = existing?.number || `CAM-${state.cameras.length + 1}`;
  document.getElementById('cam-desc').value   = existing?.description || '';

  const installZone  = document.getElementById('cam-install-zone');
  const viewZone     = document.getElementById('cam-view-zone');
  const installInput = document.getElementById('cam-install-input');
  const viewInput    = document.getElementById('cam-view-input');

  // Reset zones
  Camera.clearPreview(installZone);
  Camera.clearPreview(viewZone);

  // Restore existing photos if editing
  let tmpInstall = existing?.installPhoto || null;
  let tmpView    = existing?.viewPhoto    || null;

  if (tmpInstall) Camera.showPreview(installZone, tmpInstall);
  if (tmpView)    Camera.showPreview(viewZone, tmpView);

  // Bind cameras — save photo immediately to state on capture so it's never lost
  Camera.bind(installZone, installInput, (b64) => {
    tmpInstall = b64;
    // If we're editing an existing camera, persist immediately
    if (editIdx !== null && state.cameras[editIdx]) {
      state.cameras[editIdx].installPhoto = b64;
      state.cameras[editIdx].savedAt = new Date().toISOString();
      saveState();
      showToast('Install photo saved ✓', 'success');
    }
  });

  Camera.bind(viewZone, viewInput, (b64) => {
    tmpView = b64;
    if (editIdx !== null && state.cameras[editIdx]) {
      state.cameras[editIdx].viewPhoto = b64;
      state.cameras[editIdx].savedAt = new Date().toISOString();
      saveState();
      showToast('View photo saved ✓', 'success');
    }
  });

  modal.classList.add('show');

  // Save button
  const saveBtn = document.getElementById('cam-modal-save');
  const newSaveBtn = saveBtn.cloneNode(true); // remove old listeners
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.addEventListener('click', () => {
    const number = document.getElementById('cam-number').value.trim();
    if (!number) { showToast('Enter a camera ID', 'error'); return; }

    const entry = {
      number,
      description: document.getElementById('cam-desc').value.trim(),
      installPhoto: tmpInstall,
      viewPhoto:    tmpView,
      savedAt:      new Date().toISOString()
    };

    if (editIdx !== null) {
      state.cameras[editIdx] = entry;
    } else {
      state.cameras.push(entry);
    }

    saveState();
    renderCameraList();
    modal.classList.remove('show');
    showToast(editIdx !== null ? 'Camera updated ✓' : 'Camera added ✓', 'success');
  });

  // Cancel
  const cancelBtn = document.getElementById('cam-modal-cancel');
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  newCancel.addEventListener('click', () => {
    modal.classList.remove('show');
  });
}

// ── Preview Page ──────────────────────────────────────────────────────────────
function renderPreview() {
  const v = state.visit;
  const dateStr = v.date
    ? new Date(v.date + 'T00:00:00').toLocaleDateString('en-SG', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  document.getElementById('prev-project').textContent  = v.project    || '—';
  document.getElementById('prev-client').textContent   = v.client     || '—';
  document.getElementById('prev-location').textContent = v.location   || '—';
  document.getElementById('prev-date').textContent     = dateStr;
  document.getElementById('prev-time').textContent     = v.time       || '—';
  document.getElementById('prev-by').textContent       = v.preparedBy || '—';
  document.getElementById('prev-cameras').textContent  = state.cameras.length;

  // Photo count
  const totalPhotos = state.cameras.reduce((n, c) =>
    n + (c.installPhoto ? 1 : 0) + (c.viewPhoto ? 1 : 0), 0) + (v.coverPhoto ? 1 : 0);
  const photoCountEl = document.getElementById('prev-photo-count');
  if (photoCountEl) photoCountEl.textContent = totalPhotos;

  // Thumbnails
  const thumbs = document.getElementById('prev-thumbs');
  if (thumbs) {
    const photos = [];
    if (v.coverPhoto) photos.push({ src: v.coverPhoto, label: 'Site Cover' });
    state.cameras.forEach(cam => {
      if (cam.installPhoto) photos.push({ src: cam.installPhoto, label: `${cam.number} Install` });
      if (cam.viewPhoto)    photos.push({ src: cam.viewPhoto,    label: `${cam.number} View` });
    });
    thumbs.innerHTML = photos.slice(0, 8).map(p => `
      <div style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;flex-shrink:0">
        <img src="${p.src}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);font-size:0.5rem;color:#fff;padding:2px 3px;text-align:center;line-height:1.3">${p.label}</span>
      </div>`).join('');
    if (photos.length > 8) {
      thumbs.innerHTML += `<div style="width:72px;height:72px;border-radius:8px;background:var(--navy-700);display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:var(--slate-400)">+${photos.length - 8} more</div>`;
    }
  }

  // Completion status per camera
  const camStatus = document.getElementById('prev-cam-status');
  if (camStatus) {
    camStatus.innerHTML = state.cameras.map((cam, i) => {
      const hasInstall = !!cam.installPhoto;
      const hasView    = !!cam.viewPhoto;
      const complete   = hasInstall && hasView;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="font-size:0.82rem;color:var(--white)">${cam.number || `CAM-${i+1}`}</span>
        <div style="display:flex;gap:6px">
          <span style="font-size:0.65rem;padding:2px 7px;border-radius:4px;background:${hasInstall ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'};color:${hasInstall ? 'var(--success)' : 'var(--danger)'}">Install ${hasInstall ? '✓' : '✗'}</span>
          <span style="font-size:0.65rem;padding:2px 7px;border-radius:4px;background:${hasView ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'};color:${hasView ? 'var(--success)' : 'var(--danger)'}">View ${hasView ? '✓' : '✗'}</span>
        </div>
      </div>`;
    }).join('') || '<p class="text-muted">No cameras added yet.</p>';
  }
}

// ── Report generation ─────────────────────────────────────────────────────────
async function generateReport() {
  if (!Drive.token) { showToast('Please sign in first', 'error'); return; }
  if (!state.visit.project) { showToast('Project name required', 'error'); return; }
  if (state.cameras.length === 0) { showToast('Add at least one camera', 'error'); return; }
  try {
    const result = await Report.generate({ ...state.visit, cameras: state.cameras });
    document.getElementById('result-links').innerHTML = `
      <a href="${result.docLink}"    target="_blank" class="btn btn-secondary btn-full">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        Open Google Doc
      </a>
      <a href="${result.pdfLink}"    target="_blank" class="btn btn-primary btn-full">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF
      </a>
      <a href="${result.folderLink}" target="_blank" class="btn btn-secondary btn-full">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Open Drive Folder
      </a>`;
    showToast('Report created!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function downloadPDF() {
  await Report.downloadLocalPDF({ ...state.visit, cameras: state.cameras });
}

function newVisit() {
  if (!confirm('Start a new visit? All current data will be cleared.')) return;
  localStorage.removeItem(STATE_KEY);
  state = defaultState();
  window.state = state;
  // Reset form fields
  ['project','location','date','time','preparedBy','client','notes'].forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (el) el.value = '';
  });
  Camera.clearPreview(document.getElementById('cover-photo-zone'));
  // Auto-set new date/time
  const now = new Date();
  const dateEl = document.getElementById('field-date');
  const timeEl = document.getElementById('field-time');
  if (dateEl) { dateEl.value = now.toISOString().split('T')[0]; state.visit.date = dateEl.value; }
  if (timeEl) { timeEl.value = now.toTimeString().slice(0,5);   state.visit.time = timeEl.value; }
  saveState();
  navigateTo('project');
  showToast('New visit started');
}

// ── Resume banner ─────────────────────────────────────────────────────────────
function showResumeBanner() {
  const banner = document.getElementById('resume-banner');
  if (!banner) return;
  const saved = state.lastSaved;
  if (!saved) return;
  const when = new Date(saved).toLocaleString('en-SG', {
    day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
  });
  const camCount = state.cameras.length;
  document.getElementById('resume-info').textContent =
    `${state.visit.project || 'Unnamed visit'} · ${camCount} camera${camCount !== 1 ? 's' : ''} · Saved ${when}`;
  banner.style.display = 'flex';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const hadSavedState = loadState();
  window.state = state;

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => navigateTo(btn.dataset.page))
  );

  initProjectPage();

  document.getElementById('btn-add-camera')?.addEventListener('click', () => openCameraModal(null));
  document.getElementById('btn-generate')?.addEventListener('click', generateReport);
  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPDF);
  document.getElementById('btn-new-visit')?.addEventListener('click', newVisit);
  document.getElementById('btn-signin')?.addEventListener('click', handleSignIn);
  document.getElementById('btn-signout')?.addEventListener('click', handleSignOut);

  // Resume banner actions
  document.getElementById('btn-resume')?.addEventListener('click', () => {
    document.getElementById('resume-banner').style.display = 'none';
    navigateTo(state.currentPage || 'project');
  });
  document.getElementById('btn-discard')?.addEventListener('click', () => {
    if (confirm('Discard saved visit and start fresh?')) {
      newVisit();
      document.getElementById('resume-banner').style.display = 'none';
    }
  });

  // Show resume banner if we have saved data with a project name
  if (hadSavedState && state.visit.project) {
    showResumeBanner();
  }

  navigateTo(state.currentPage || 'project');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/fortx-site-visit/sw.js').catch(console.warn);
  }
});
