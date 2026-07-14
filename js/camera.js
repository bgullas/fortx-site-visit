// Camera & Photo capture utilities
const Camera = {
  // Compress and return base64 image from File/Blob
  async processImage(file, maxW = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxW) { height = (height * maxW) / width; width = maxW; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });
  },

  // Bind a photo-capture zone to an input
  bind(zoneEl, inputEl, onCapture) {
    zoneEl.addEventListener('click', () => inputEl.click());
    inputEl.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const b64 = await Camera.processImage(file);
        Camera.showPreview(zoneEl, b64);
        onCapture(b64);
      } catch (err) {
        console.error('Image processing error', err);
        showToast('Failed to process image', 'error');
      }
      inputEl.value = ''; // reset so same file can be re-selected
    });
  },

  showPreview(zoneEl, b64) {
    // Remove existing preview
    const prev = zoneEl.querySelector('img');
    if (prev) prev.remove();
    const placeholder = zoneEl.querySelector('.ph-content');
    if (placeholder) placeholder.style.display = 'none';

    const img = document.createElement('img');
    img.src = b64;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit';

    let retake = zoneEl.querySelector('.photo-retake');
    if (!retake) {
      retake = document.createElement('button');
      retake.className = 'photo-retake';
      retake.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Retake`;
      retake.addEventListener('click', (e) => {
        e.stopPropagation();
        inputEl_ref.click();
      });
      zoneEl.appendChild(retake);
    }

    zoneEl.appendChild(img);
    zoneEl.style.minHeight = '160px';
  },

  clearPreview(zoneEl) {
    const img = zoneEl.querySelector('img');
    if (img) img.remove();
    const placeholder = zoneEl.querySelector('.ph-content');
    if (placeholder) placeholder.style.display = '';
    const retake = zoneEl.querySelector('.photo-retake');
    if (retake) retake.remove();
  }
};

// Make globally available
window.Camera = Camera;
