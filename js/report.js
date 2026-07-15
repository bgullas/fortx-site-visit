'use strict';

const Report = {
  TEMPLATE_ID: 'YOUR_TEMPLATE_DOC_ID',

  async generate(visitData) {
    showOverlay('Creating project folder…');
    const projectName = visitData.project || 'Unnamed Project';
    const dateStr = new Date(visitData.date + 'T00:00:00').toLocaleDateString('en-SG', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const docName = `${projectName} — Site Visit ${dateStr}`;

    try {
      const folder = await Drive.getOrCreateFolder(projectName);
      showOverlay('Uploading photos…');

      const photoUrls = {};
      let idx = 0;
      for (const cam of visitData.cameras) {
        idx++;
        if (cam.installPhoto) {
          const f = await Drive.uploadImage(cam.installPhoto, `CAM${idx}_install.jpg`, folder.id);
          photoUrls[`cam${idx}_install`] = `https://drive.google.com/uc?id=${f.id}`;
        }
        if (cam.viewPhoto) {
          const f = await Drive.uploadImage(cam.viewPhoto, `CAM${idx}_view.jpg`, folder.id);
          photoUrls[`cam${idx}_view`] = `https://drive.google.com/uc?id=${f.id}`;
        }
        if (idx === 1 && visitData.coverPhoto) {
          await Drive.uploadImage(visitData.coverPhoto, 'site_cover.jpg', folder.id);
        }
      }

      showOverlay('Creating report document…');
      const copied = await Drive.copyTemplate(Report.TEMPLATE_ID, docName, folder.id);
      const docId = copied.id;

      const replacements = {
        PROJECT:       visitData.project    || '',
        CLIENT:        visitData.client     || '',
        LOCATION:      visitData.location   || '',
        DATE:          dateStr,
        TIME:          visitData.time       || '',
        PREPARED_BY:   visitData.preparedBy || '',
        TOTAL_CAMERAS: visitData.cameras.length.toString(),
        VISIT_NOTES:   visitData.notes      || '',
      };
      visitData.cameras.forEach((cam, i) => {
        const n = i + 1;
        replacements[`CAM${n}_NUMBER`] = cam.number      || `CAM-${n}`;
        replacements[`CAM${n}_DESC`]   = cam.description || '';
      });

      showOverlay('Filling report data…');
      await Drive.replacePlaceholders(docId, replacements);

      // Clear photo placeholders (images inserted separately)
      const clearRequests = [];
      visitData.cameras.forEach((cam, i) => {
        const n = i + 1;
        clearRequests.push({ replaceAllText: { containsText: { text: `{{CAM${n}_INSTALL_PHOTO}}`, matchCase: true }, replaceText: '' } });
        clearRequests.push({ replaceAllText: { containsText: { text: `{{CAM${n}_VIEW_PHOTO}}`,    matchCase: true }, replaceText: '' } });
      });
      if (clearRequests.length) await Drive.batchUpdateDoc(docId, clearRequests);

      showOverlay('Generating PDF…');
      const pdfBlob = await Drive.exportAsPDF(docId);

      const pdfName = `${docName}.pdf`;
      const pdfForm = new FormData();
      pdfForm.append('metadata', new Blob([JSON.stringify({ name: pdfName, parents: [folder.id] })], { type: 'application/json' }));
      pdfForm.append('file', pdfBlob);
      const pdfRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Drive.token}` },
        body: pdfForm
      });
      const pdfFile = await pdfRes.json();

      hideOverlay();
      return {
        success:    true,
        docId,
        folderId:   folder.id,
        docLink:    `https://docs.google.com/document/d/${docId}`,
        pdfLink:    pdfFile.webViewLink,
        folderLink: `https://drive.google.com/drive/folders/${folder.id}`
      };
    } catch (err) {
      hideOverlay();
      throw err;
    }
  },

  // ── Local PDF with FortX logo ──────────────────────────────────────────────
  async downloadLocalPDF(visitData) {
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, M = 18; // page width, margin

    const NAVY  = [10, 16, 54];
    const BLUE  = [30, 111, 255];
    const WHITE = [255, 255, 255];
    const GRAY  = [148, 163, 184];
    const LIGHT = [238, 244, 255];

    let y = 0;

    // ── Cover page ──
    // Navy header bar
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 52, 'F');

    // FortX logo (if available)
    if (typeof FORTX_LOGO_B64 !== 'undefined') {
      try {
        doc.addImage(FORTX_LOGO_B64, 'PNG', M, 8, 72, 16);
      } catch(e) { console.warn('Logo insert failed', e); }
    }

    // Blue accent line
    doc.setFillColor(...BLUE);
    doc.rect(0, 52, W, 1.5, 'F');

    // "Powered by BluGraph" text
    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Powered by BluGraph Technologies', W - M, 47, { align: 'right' });

    // Report title
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTECT  •  MONITOR  •  MANAGE', M, 33);
    doc.setFontSize(14);
    doc.text('CCTV SITE VISIT REPORT', M, 44);

    y = 66;

    // ── Project info table ──
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text('PROJECT INFORMATION', M, y); y += 5;

    const dateStr = visitData.date
      ? new Date(visitData.date + 'T00:00:00').toLocaleDateString('en-SG', { day:'2-digit', month:'long', year:'numeric' })
      : '—';

    const infoRows = [
      ['Project Name',  visitData.project    || '—'],
      ['Client',        visitData.client     || '—'],
      ['Site Location', visitData.location   || '—'],
      ['Visit Date',    dateStr],
      ['Visit Time',    visitData.time       || '—'],
      ['Prepared By',   visitData.preparedBy || '—'],
      ['Total Cameras', visitData.cameras.length.toString()],
    ];

    infoRows.forEach(([label, val]) => {
      doc.setFillColor(...NAVY);
      doc.rect(M, y - 4, 48, 8, 'F');
      doc.setFillColor(...LIGHT);
      doc.rect(M + 48, y - 4, W - M * 2 - 48, 8, 'F');

      doc.setTextColor(...BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label.toUpperCase(), M + 2, y + 0.5);

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(val), M + 50, y + 0.5);
      y += 8;
    });

    // ── Visit notes ──
    if (visitData.notes) {
      y += 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLUE);
      doc.text('VISIT NOTES', M, y); y += 5;
      doc.setFillColor(...LIGHT);
      const lines = doc.splitTextToSize(visitData.notes, W - M * 2 - 4);
      const noteH = lines.length * 5 + 6;
      doc.rect(M, y - 4, W - M * 2, noteH, 'F');
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(lines, M + 2, y + 0.5);
      y += noteH;
    }

    // ── Camera sections ──
    for (const [i, cam] of visitData.cameras.entries()) {
      // Page break check
      if (y > 240) { doc.addPage(); y = 20; }

      y += 6;

      // Camera header bar
      doc.setFillColor(...NAVY);
      doc.rect(M, y - 5, W - M * 2, 11, 'F');
      doc.setFillColor(...BLUE);
      doc.rect(M, y + 6, W - M * 2, 1, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`CAMERA ${i + 1}  —  ${cam.number || `CAM-${i+1}`}`, M + 3, y + 2);
      y += 14;

      // Description
      doc.setFillColor(...NAVY);
      doc.rect(M, y - 4, 40, 7, 'F');
      doc.setFillColor(...LIGHT);
      doc.rect(M + 40, y - 4, W - M * 2 - 40, 7, 'F');
      doc.setTextColor(...BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('DESCRIPTION', M + 2, y);
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const descLines = doc.splitTextToSize(cam.description || '—', W - M * 2 - 44);
      doc.text(descLines, M + 42, y);
      y += Math.max(7, descLines.length * 4 + 3);

      // Photos
      y += 4;
      const photoW = (W - M * 2 - 6) / 2;
      const photoH = photoW * 0.65;

      if (y + photoH + 16 > 285) { doc.addPage(); y = 20; }

      // Photo labels
      doc.setFillColor(...BLUE);
      doc.rect(M, y, photoW, 7, 'F');
      doc.setFillColor(77, 143, 255);
      doc.rect(M + photoW + 6, y, photoW, 7, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('INSTALLATION PHOTO', M + 2, y + 4.5);
      doc.text('VIEW FROM CAMERA', M + photoW + 8, y + 4.5);
      y += 7;

      // Photo boxes
      doc.setFillColor(...LIGHT);
      doc.rect(M, y, photoW, photoH, 'F');
      doc.rect(M + photoW + 6, y, photoW, photoH, 'F');

      // Insert actual photos
      if (cam.installPhoto) {
        try { doc.addImage(cam.installPhoto, 'JPEG', M, y, photoW, photoH, undefined, 'MEDIUM'); }
        catch(e) { console.warn('Install photo error', e); }
      } else {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('No photo captured', M + photoW / 2, y + photoH / 2, { align: 'center' });
      }

      if (cam.viewPhoto) {
        try { doc.addImage(cam.viewPhoto, 'JPEG', M + photoW + 6, y, photoW, photoH, undefined, 'MEDIUM'); }
        catch(e) { console.warn('View photo error', e); }
      } else {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('No photo captured', M + photoW + 6 + photoW / 2, y + photoH / 2, { align: 'center' });
      }

      y += photoH + 4;
    }

    // ── Footer on all pages ──
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor(...NAVY);
      doc.rect(0, 285, W, 12, 'F');
      doc.setTextColor(...GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('FortX Security Systems  |  Powered by BluGraph Technologies  |  Confidential Site Survey', W / 2, 291, { align: 'center' });
      doc.text(`Page ${p} of ${pageCount}`, W - M, 291, { align: 'right' });
    }

    const filename = `${visitData.project || 'SiteVisit'}_Report_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    showToast('PDF downloaded!', 'success');
  }
};

window.Report = Report;
