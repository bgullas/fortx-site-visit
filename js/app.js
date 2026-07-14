// FortX Site Visit PWA — Main App
'use strict';

// ── State ──
const STATE_KEY = 'fortx_visit_state';
let state = {
  auth: { signedIn: false, user: null },
  visit: {
    project: '', location: '', date: '', time: '', preparedBy: '', client: '', notes: '',
    coverPhoto: null
  },
  cameras: [], // [{ number, description, installPhoto, viewPhoto }]
  currentPage: 'project',
  editingCamIdx: null
};

// ── Persistence ──
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    showSaveIndicator();
  } catch (e) { console.warn('Save failed', e); }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      // Don't persist auth beyond session
      state.auth = { signedIn: false, user: null };
    }
  } catch (e) { localStorage.removeItem(STATE_KEY); }
}

// ── Auto-save on input ──
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 800); }

// ── UI Utilities ──
function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = `toast ${type}`;
  requestAnimationFrame(() => { t.classList.add('show'); });
  setTimeout(() => t.classList.remove('show'), 2800);
}

function showOverlay(msg = 'Processing…') {
  const o = document.getElementById('overlay');
  if (o) { o.querySelector('.overlay-msg').textContent = msg; o.classList.add('show'); }
}
function hideOverlay() { document.getElementById('overlay')?.classList.remove('show'); }
window.showToast = showToast; window.showOverlay = showOverlay; window.hideOverlay = hideOverlay;

// ── Page Navigation ──
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  state.currentPage = pageId;
  document.getElementById('topbar-title').textContent = pageLabels[pageId] || '';

  // Refresh page content if needed
  if (pageId === 'cameras') renderCameraList();
  if (pageId === 'preview') renderPreview();
  saveState();
}

const pageLabels = {
  project: 'Project Info', cameras: 'Camera Locations',
  preview: 'Preview', complete: 'Complete & Export'
};

// ── Auth ──
async function handleSignIn() {
  try {
    showOverlay('Signing in with Google…');
    await Drive.signIn();
    state.auth.signedIn = true;
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
  state.auth.signedIn = false;
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ── Project Page ──
function initProjectPage() {
  const fields = ['project', 'location', 'date', 'time', 'preparedBy', 'client', 'notes'];
  fields.forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (!el) return;
    if (state.visit[f]) el.value = state.visit[f];
    el.addEventListener('input', () => { state.visit[f] = el.value; scheduleSave(); });
  });

  // Set default date/time
  if (!state.visit.date) {
    const now = new Date();
    document.getElementById('field-date').value = now.toISOString().split('T')[0];
    state.visit.date = document.getElementById('field-date').value;
    document.getElementById('field-time').value = now.toTimeString().slice(0, 5);
    state.visit.time = document.getElementById('field-time').value;
  }

  // Cover photo
  const coverZone = document.getElementById('cover-photo-zone');
  const coverInput = document.getElementById('cover-photo-input');
  if (coverZone && coverInput) {
    if (state.visit.coverPhoto) Camera.showPreview(coverZone, state.visit.coverPhoto);
    Camera.bind(coverZone, coverInput, (b64) => { state.visit.coverPhoto = b64; scheduleSave(); });
  }

  document.getElementById('btn-next-cameras')?.addEventListener('click', () => {
    if (!state.visit.project.trim()) { showToast('Please enter a project name', 'error'); return; }
    if (!state.visit.location.trim()) { showToast('Please enter a location', 'error'); return; }
    navigateTo('cameras');
  });
}

// ── Camera List Page ──
function renderCameraList() {
  const list = document.getElementById('camera-list');
  const badge = document.getElementById('cam-badge');
  if (badge) badge.textContent = state.cameras.length || '';
  if (!list) return;

  if (state.cameras.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      <p>No camera locations added yet.<br>Tap <strong>Add Camera</strong> to begin.</p>
    </div>`;
    return;
  }

  list.innerHTML = state.cameras.map((cam, i) => `
    <div class="cam-entry" data-idx="${i}">
      <div class="cam-entry-header">
        <span class="cam-entry-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          ${cam.number || `CAM-${i + 1}`}
        </span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.75rem" onclick="editCamera(${i})">Edit</button>
          <button class="btn btn-danger" style="padding:6px 12px;font-size:0.75rem" onclick="deleteCamera(${i})">Delete</button>
        </div>
      </div>
      <div class="cam-entry-body">
        <p style="font-size:0.82rem;color:var(--slate-400)">${cam.description || 'No description'}</p>
        <div class="cam-photos">
          ${cam.installPhoto ? `<div style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:4/3"><img src="${cam.installPhoto}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);font-size:0.6rem;color:#fff;padding:2px 6px;border-radius:4px">Install</span></div>` : '<div style="aspect-ratio:4/3;background:var(--navy-700);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--slate-400)">No photo</div>'}
          ${cam.viewPhoto ? `<div style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:4/3"><img src="${cam.viewPhoto}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);font-size:0.6rem;color:#fff;padding:2px 6px;border-radius:4px">View</span></div>` : '<div style="aspect-ratio:4/3;background:var(--navy-700);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--slate-400)">No photo</div>'}
        </div>
      </div>
    </div>
  `).join('');
}

window.editCamera = function(idx) {
  state.editingCamIdx = idx;
  openCameraModal(state.cameras[idx]);
};

window.deleteCamera = function(idx) {
  if (!confirm(`Delete ${state.cameras[idx]?.number || `CAM-${idx + 1}`}?`)) return;
  state.cameras.splice(idx, 1);
  saveState(); renderCameraList();
  showToast('Camera removed');
};

function openCameraModal(existing = null) {
  const modal = document.getElementById('camera-modal');
  if (!modal) return;

  // Reset form
  document.getElementById('cam-number').value = existing?.number || `CAM-${state.cameras.length + 1}`;
  document.getElementById('cam-desc').value = existing?.description || '';

  // Photo zones
  const installZone = document.getElementById('cam-install-zone');
  const viewZone = document.getElementById('cam-view-zone');
  Camera.clearPreview(installZone); Camera.clearPreview(viewZone);

  let tmpInstall = existing?.installPhoto || null;
  let tmpView = existing?.viewPhoto || null;

  if (tmpInstall) Camera.showPreview(installZone, tmpInstall);
  if (tmpView) Camera.showPreview(viewZone, tmpView);

  Camera.bind(installZone, document.getElementById('cam-install-input'), b64 => { tmpInstall = b64; });
  Camera.bind(viewZone, document.getElementById('cam-view-input'), b64 => { tmpView = b64; });

  modal.classList.add('show');

  document.getElementById('cam-modal-save').onclick = () => {
    const number = document.getElementById('cam-number').value.trim();
    const description = document.getElementById('cam-desc').value.trim();
    if (!number) { showToast('Enter a camera ID', 'error'); return; }

    const entry = { number, description, installPhoto: tmpInstall, viewPhoto: tmpView };
    if (state.editingCamIdx !== null) {
      state.cameras[state.editingCamIdx] = entry;
      state.editingCamIdx = null;
    } else {
      state.cameras.push(entry);
    }
    saveState(); renderCameraList();
    modal.classList.remove('show');
    showToast('Camera saved', 'success');
  };

  document.getElementById('cam-modal-cancel').onclick = () => {
    state.editingCamIdx = null;
    modal.classList.remove('show');
  };
}

// ── Preview Page ──
function renderPreview() {
  const v = state.visit;
  const dateStr = v.date ? new Date(v.date + 'T00:00:00').toLocaleDateString('en-SG', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  document.getElementById('prev-project').textContent = v.project || '—';
  document.getElementById('prev-client').textContent = v.client || '—';
  document.getElementById('prev-location').textContent = v.location || '—';
  document.getElementById('prev-date').textContent = dateStr;
  document.getElementById('prev-time').textContent = v.time || '—';
  document.getElementById('prev-by').textContent = v.preparedBy || '—';
  document.getElementById('prev-cameras').textContent = state.cameras.length;

  const thumbs = document.getElementById('prev-thumbs');
  if (thumbs) {
    thumbs.innerHTML = state.cameras.flatMap(cam => [cam.installPhoto, cam.viewPhoto]).filter(Boolean)
      .slice(0, 6).map(p => `<div style="width:64px;height:64px;border-radius:8px;overflow:hidden;flex-shrink:0"><img src="${p}" style="width:100%;height:100%;object-fit:cover"></div>`).join('');
  }
}

// ── Complete Page ──
async function generateReport() {
  if (!state.auth.signedIn) { showToast('Please sign in first', 'error'); return; }
  if (!state.visit.project) { showToast('Project name required', 'error'); return; }
  if (state.cameras.length === 0) { showToast('Add at least one camera', 'error'); return; }

  try {
    const result = await Report.generate({ ...state.visit, cameras: state.cameras });
    document.getElementById('result-links').innerHTML = `
      <a href="${result.docLink}" target="_blank" class="btn btn-secondary btn-full">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        Open Google Doc
      </a>
      <a href="${result.pdfLink}" target="_blank" class="btn btn-primary btn-full">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF
      </a>
      <a href="${result.folderLink}" target="_blank" class="btn btn-secondary btn-full">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
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
  if (!confirm('Start a new visit? Current data will be cleared.')) return;
  state.visit = { project: '', location: '', date: '', time: '', preparedBy: '', notes: '', coverPhoto: null };
  state.cameras = [];
  localStorage.removeItem(STATE_KEY);
  navigateTo('project');
  initProjectPage();
  showToast('New visit started');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Init pages
  initProjectPage();

  // Add camera button
  document.getElementById('btn-add-camera')?.addEventListener('click', () => {
    state.editingCamIdx = null;
    openCameraModal();
  });

  // Generate report
  document.getElementById('btn-generate')?.addEventListener('click', generateReport);
  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPDF);
  document.getElementById('btn-new-visit')?.addEventListener('click', newVisit);

  // Sign in button
  document.getElementById('btn-signin')?.addEventListener('click', handleSignIn);
  document.getElementById('btn-signout')?.addEventListener('click', handleSignOut);

  // Navigate to saved page
  navigateTo(state.currentPage || 'project');

  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
  }
});
