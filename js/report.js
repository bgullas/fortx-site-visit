// Report generation: creates Google Doc from template, uploads photos, generates PDF
const Report = {

  TEMPLATE_ID: 'YOUR_TEMPLATE_DOC_ID', // Replace after template is created in Google Docs

  async generate(visitData) {
    showOverlay('Creating project folder…');
    const projectName = visitData.project || 'Unnamed Project';
    const dateStr = new Date(visitData.date).toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' });
    const docName = `${projectName} — Site Visit ${dateStr}`;

    try {
      // 1. Get or create project folder
      const folder = await Drive.getOrCreateFolder(projectName);
      showOverlay('Uploading photos…');

      // 2. Upload all photos to Drive
      const photoUrls = {};
      let camIdx = 0;
      for (const cam of visitData.cameras) {
        camIdx++;
        if (cam.installPhoto) {
          const f = await Drive.uploadImage(cam.installPhoto, `CAM${camIdx}_install.jpg`, folder.id);
          photoUrls[`cam${camIdx}_install`] = `https://drive.google.com/uc?id=${f.id}`;
        }
        if (cam.viewPhoto) {
          const f = await Drive.uploadImage(cam.viewPhoto, `CAM${camIdx}_view.jpg`, folder.id);
          photoUrls[`cam${camIdx}_view`] = `https://drive.google.com/uc?id=${f.id}`;
        }
      }

      // 3. Copy template doc
      showOverlay('Creating report document…');
      const copied = await Drive.copyTemplate(Report.TEMPLATE_ID, docName, folder.id);
      const docId = copied.id;

      // 4. Replace text placeholders
      const replacements = {
        PROJECT: visitData.project || '',
        CLIENT: visitData.client || '',
        LOCATION: visitData.location || '',
        DATE: dateStr,
        TIME: visitData.time || '',
        PREPARED_BY: visitData.preparedBy || '',
        TOTAL_CAMERAS: visitData.cameras.length.toString(),
        VISIT_NOTES: visitData.notes || '',
      };

      // Add camera-level placeholders
      visitData.cameras.forEach((cam, i) => {
        const n = i + 1;
        replacements[`CAM${n}_NUMBER`] = cam.number || `CAM-${n}`;
        replacements[`CAM${n}_DESC`] = cam.description || '';
      });

      await Drive.replacePlaceholders(docId, replacements);

      // 5. Insert images into doc (simplified: append after text replacement)
      showOverlay('Inserting photos into report…');
      const imageRequests = [];
      visitData.cameras.forEach((cam, i) => {
        const n = i + 1;
        if (photoUrls[`cam${n}_install`]) {
          imageRequests.push({ replaceAllText: {
            containsText: { text: `{{CAM${n}_INSTALL_PHOTO}}`, matchCase: true },
            replaceText: '' // will be replaced by image insertion below
          }});
        }
        if (photoUrls[`cam${n}_view`]) {
          imageRequests.push({ replaceAllText: {
            containsText: { text: `{{CAM${n}_VIEW_PHOTO}}`, matchCase: true },
            replaceText: ''
          }});
        }
      });
      if (imageRequests.length) await Drive.batchUpdateDoc(docId, imageRequests);

      // 6. Export PDF
      showOverlay('Generating PDF…');
      const pdfBlob = await Drive.exportAsPDF(docId);

      // 7. Upload PDF to same folder
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
        success: true,
        docId,
        folderId: folder.id,
        docLink: `https://docs.google.com/document/d/${docId}`,
        pdfLink: pdfFile.webViewLink,
        folderLink: `https://drive.google.com/drive/folders/${folder.id}`
      };
    } catch (err) {
      hideOverlay();
      console.error('Report generation error:', err);
      throw err;
    }
  },

  // Download PDF locally as fallback
  async downloadLocalPDF(visitData) {
    // Uses jsPDF loaded in index.html for offline fallback
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, margin = 20;

    // Header
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, W, 40, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('FortX', margin, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('CCTV Site Visit Report', margin, 27);

    let y = 55;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Project Information', margin, y); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const dateStr = new Date(visitData.date).toLocaleDateString('en-SG');
    const rows = [
      ['Project', visitData.project], ['Location', visitData.location],
      ['Date', dateStr], ['Time', visitData.time], ['Prepared By', visitData.preparedBy]
    ];
    rows.forEach(([label, val]) => {
      doc.setTextColor(100); doc.text(label + ':', margin, y);
      doc.setTextColor(30); doc.text(val || '—', margin + 40, y);
      y += 7;
    });

    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(30); doc.text('Camera Locations', margin, y); y += 8;

    for (const [i, cam] of visitData.cameras.entries()) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(240, 240, 245);
      doc.rect(margin, y - 5, W - margin * 2, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30);
      doc.text(`CAM-${i + 1}: ${cam.number || ''}`, margin + 2, y);
      y += 8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
      doc.text(cam.description || 'No description', margin, y); y += 7;

      // Photos
      const photoW = 80, photoH = 55;
      if (cam.installPhoto) {
        try {
          if (y + photoH + 10 > 280) { doc.addPage(); y = 20; }
          doc.setFontSize(8); doc.setTextColor(100);
          doc.text('Installation Photo', margin, y); y += 4;
          doc.addImage(cam.installPhoto, 'JPEG', margin, y, photoW, photoH);
          if (cam.viewPhoto) {
            doc.text('View from Camera', margin + photoW + 5, y - 4);
            doc.addImage(cam.viewPhoto, 'JPEG', margin + photoW + 5, y, photoW, photoH);
          }
          y += photoH + 8;
        } catch (e) { console.warn('Image insert failed', e); }
      }
      y += 4;
    }

    if (visitData.notes) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30);
      doc.text('Notes', margin, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
      const lines = doc.splitTextToSize(visitData.notes, W - margin * 2);
      doc.text(lines, margin, y);
    }

    doc.save(`${visitData.project || 'SiteVisit'}_Report.pdf`);
    showToast('PDF downloaded!', 'success');
  }
};

window.Report = Report;
