/**
 * FortX Site Visit — Google Apps Script Template Creator v4
 * Verified against official GAS TableCell API docs.
 * 
 * TableCell supports: setBackgroundColor, setPaddingTop/Bottom/Left/Right,
 *   setWidth, setVerticalAlignment, setTextAlignment, editAsText, appendParagraph
 * TableCell does NOT support: setMinimumHeight (use TableRow.setMinimumHeight instead)
 * Table does NOT support: setIndentStart/End, setBorderColor, setBorderWidth
 *   (use setAttributes instead for border/color on Table)
 * 
 * Run deleteOldTemplate() first if a broken template exists, then run createTemplate().
 */

var BASE_FOLDER_ID = '1iXQQolBCGsCA4xrpzaCy70YW53i2FyB1';
var MAX_CAMERAS = 20;

// Brand colors
var NAVY     = '#0A1036';
var BLUE     = '#1E6FFF';
var BLUE_LT  = '#4D8FFF';
var MID_NAVY = '#111C52';
var WHITE    = '#FFFFFF';
var GRAY     = '#94A3B8';
var BG_LIGHT = '#EEF4FF';

// ── Helpers ──────────────────────────────────────────────────────────────────

function styleLabel(cell, width) {
  cell.setBackgroundColor(MID_NAVY);
  cell.setPaddingTop(7);
  cell.setPaddingBottom(7);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);
  if (width) cell.setWidth(width);
  var txt = cell.editAsText();
  txt.setFontFamily('Arial');
  txt.setFontSize(8);
  txt.setBold(true);
  txt.setForegroundColor(BLUE_LT);
}

function styleValue(cell) {
  cell.setBackgroundColor(BG_LIGHT);
  cell.setPaddingTop(7);
  cell.setPaddingBottom(7);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);
  var txt = cell.editAsText();
  txt.setFontFamily('Arial');
  txt.setFontSize(10);
  txt.setBold(false);
  txt.setForegroundColor(NAVY);
}

// Style a standard 2-col label/value table
function styleInfoTable(tbl, labelWidth) {
  // Table border via attributes
  var tblAttrs = {};
  tblAttrs[DocumentApp.Attribute.BORDER_COLOR] = '#C8DCFF';
  tblAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 1;
  tbl.setAttributes(tblAttrs);

  for (var r = 0; r < tbl.getNumRows(); r++) {
    styleLabel(tbl.getRow(r).getCell(0), labelWidth || 130);
    styleValue(tbl.getRow(r).getCell(1));
  }
}

function addBlueRule(body) {
  var p = body.appendParagraph('');
  var attrs = {};
  attrs[DocumentApp.Attribute.BACKGROUND_COLOR] = BLUE;
  attrs[DocumentApp.Attribute.SPACING_BEFORE]   = 0;
  attrs[DocumentApp.Attribute.SPACING_AFTER]    = 0;
  p.setAttributes(attrs);
  return p;
}

function addSectionLabel(body, text) {
  var p = body.appendParagraph(text);
  p.setSpacingBefore(14);
  p.setSpacingAfter(4);
  var txt = p.editAsText();
  txt.setFontFamily('Arial');
  txt.setFontSize(8);
  txt.setBold(true);
  txt.setForegroundColor(BLUE);
  txt.setBackgroundColor('#E0ECFF');
  return p;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function createTemplate() {
  var folder = DriveApp.getFolderById(BASE_FOLDER_ID);
  var doc    = DocumentApp.create('FortX Site Visit Report — TEMPLATE');
  DriveApp.getFileById(doc.getId()).moveTo(folder);

  var body = doc.getBody();
  body.clear();
  body.setPageWidth(612);
  body.setPageHeight(792);
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(54);
  body.setMarginRight(54);

  // ── Header banner (1-cell table, full-width navy) ──
  var hTable = body.appendTable([['']]);
  var hAttrs = {};
  hAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 0;
  hTable.setAttributes(hAttrs);

  var hCell = hTable.getCell(0, 0);
  hCell.setBackgroundColor(NAVY);
  hCell.setPaddingTop(16);
  hCell.setPaddingBottom(10);
  hCell.setPaddingLeft(16);
  hCell.setPaddingRight(16);

  // Remove the default blank paragraph GAS inserts
  hCell.removeChild(hCell.getChild(0));

  var hTitle = hCell.appendParagraph('FORTX  |  CCTV Site Visit Report');
  var htxt = hTitle.editAsText();
  htxt.setFontFamily('Arial');
  htxt.setFontSize(15);
  htxt.setBold(true);
  htxt.setForegroundColor(WHITE);

  var hSub = hCell.appendParagraph('PROTECT  •  MONITOR  •  MANAGE  |  Powered by BluGraph Technologies');
  hSub.setSpacingBefore(4);
  var hstxt = hSub.editAsText();
  hstxt.setFontFamily('Arial');
  hstxt.setFontSize(8);
  hstxt.setBold(false);
  hstxt.setForegroundColor(BLUE_LT);

  addBlueRule(body);

  // ── Project Information ──
  addSectionLabel(body, '  PROJECT INFORMATION');

  var infoTable = body.appendTable([
    ['PROJECT NAME', '{{PROJECT}}'],
    ['CLIENT',       '{{CLIENT}}'],
    ['SITE LOCATION','{{LOCATION}}'],
    ['VISIT DATE',   '{{DATE}}'],
    ['VISIT TIME',   '{{TIME}}'],
    ['PREPARED BY',  '{{PREPARED_BY}}'],
    ['TOTAL CAMERAS','{{TOTAL_CAMERAS}}'],
  ]);
  styleInfoTable(infoTable, 140);

  // ── Visit Notes ──
  addSectionLabel(body, '  VISIT NOTES & OBSERVATIONS');

  var notesTable = body.appendTable([['{{VISIT_NOTES}}']]);
  var ntAttrs = {};
  ntAttrs[DocumentApp.Attribute.BORDER_COLOR] = '#C8DCFF';
  ntAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 1;
  notesTable.setAttributes(ntAttrs);

  var nc = notesTable.getCell(0, 0);
  nc.setBackgroundColor(BG_LIGHT);
  nc.setPaddingTop(10);
  nc.setPaddingBottom(10);
  nc.setPaddingLeft(10);
  nc.setPaddingRight(10);
  var nctxt = nc.editAsText();
  nctxt.setFontFamily('Arial');
  nctxt.setFontSize(10);
  nctxt.setForegroundColor(NAVY);
  // Set minimum height via the row (correct API)
  notesTable.getRow(0).setMinimumHeight(60);

  // ── Page break before cameras ──
  body.appendPageBreak();

  // ── Camera sections ──
  for (var i = 1; i <= MAX_CAMERAS; i++) {

    // Camera header band
    var camBand = body.appendTable([[' CAMERA ' + i + '   —   {{CAM' + i + '_NUMBER}}']]);
    var cbAttrs = {};
    cbAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 0;
    camBand.setAttributes(cbAttrs);

    var cbCell = camBand.getCell(0, 0);
    cbCell.setBackgroundColor(NAVY);
    cbCell.setPaddingTop(10);
    cbCell.setPaddingBottom(10);
    cbCell.setPaddingLeft(12);
    cbCell.setPaddingRight(12);
    var cbTxt = cbCell.editAsText();
    cbTxt.setFontFamily('Arial');
    cbTxt.setFontSize(11);
    cbTxt.setBold(true);
    cbTxt.setForegroundColor(WHITE);

    addBlueRule(body);

    // Camera details table
    var camTable = body.appendTable([
      ['CAMERA ID',   '{{CAM' + i + '_NUMBER}}'],
      ['DESCRIPTION', '{{CAM' + i + '_DESC}}'],
    ]);
    styleInfoTable(camTable, 130);
    // Min height on the description row via TableRow
    camTable.getRow(1).setMinimumHeight(45);

    // Spacer
    body.appendParagraph('').setSpacingBefore(10).setSpacingAfter(0);

    // Photo label row (blue/blue-lt header)
    var lblTable = body.appendTable([['  INSTALLATION PHOTO', '  VIEW FROM CAMERA']]);
    var lblAttrs = {};
    lblAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 0;
    lblTable.setAttributes(lblAttrs);

    var lbl0 = lblTable.getRow(0).getCell(0);
    lbl0.setBackgroundColor(BLUE);
    lbl0.setPaddingTop(5);
    lbl0.setPaddingBottom(5);
    lbl0.setPaddingLeft(8);
    lbl0.setPaddingRight(8);
    var l0txt = lbl0.editAsText();
    l0txt.setFontFamily('Arial');
    l0txt.setFontSize(8);
    l0txt.setBold(true);
    l0txt.setForegroundColor(WHITE);

    var lbl1 = lblTable.getRow(0).getCell(1);
    lbl1.setBackgroundColor(BLUE_LT);
    lbl1.setPaddingTop(5);
    lbl1.setPaddingBottom(5);
    lbl1.setPaddingLeft(8);
    lbl1.setPaddingRight(8);
    var l1txt = lbl1.editAsText();
    l1txt.setFontFamily('Arial');
    l1txt.setFontSize(8);
    l1txt.setBold(true);
    l1txt.setForegroundColor(WHITE);

    // Photo placeholder table
    var photoTable = body.appendTable([
      ['{{CAM' + i + '_INSTALL_PHOTO}}', '{{CAM' + i + '_VIEW_PHOTO}}']
    ]);
    var ptAttrs = {};
    ptAttrs[DocumentApp.Attribute.BORDER_COLOR] = '#C8DCFF';
    ptAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 1;
    photoTable.setAttributes(ptAttrs);

    var pc0 = photoTable.getRow(0).getCell(0);
    pc0.setBackgroundColor(BG_LIGHT);
    pc0.setPaddingTop(4);
    pc0.setPaddingBottom(4);
    pc0.setPaddingLeft(4);
    pc0.setPaddingRight(4);

    var pc1 = photoTable.getRow(0).getCell(1);
    pc1.setBackgroundColor(BG_LIGHT);
    pc1.setPaddingTop(4);
    pc1.setPaddingBottom(4);
    pc1.setPaddingLeft(4);
    pc1.setPaddingRight(4);

    // Set photo row height via TableRow
    photoTable.getRow(0).setMinimumHeight(160);

    // Spacing between cameras
    if (i < MAX_CAMERAS) {
      if (i % 2 === 0) {
        body.appendPageBreak();
      } else {
        body.appendParagraph('').setSpacingBefore(12).setSpacingAfter(0);
      }
    }
  }

  // ── Footer ──
  var footer = doc.addFooter();
  var ftPara = footer.appendParagraph(
    'FortX Security Systems  |  Powered by BluGraph Technologies  |  Confidential Site Survey'
  );
  ftPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  var ftTxt = ftPara.editAsText();
  ftTxt.setFontFamily('Arial');
  ftTxt.setFontSize(7);
  ftTxt.setForegroundColor(GRAY);

  doc.saveAndClose();

  Logger.log('==============================================');
  Logger.log('  FortX Template Created Successfully!');
  Logger.log('==============================================');
  Logger.log('');
  Logger.log('Template Document ID:');
  Logger.log(doc.getId());
  Logger.log('');
  Logger.log('Template URL:');
  Logger.log(doc.getUrl());
  Logger.log('');
  Logger.log('ACTION REQUIRED:');
  Logger.log('Paste the Document ID above into js/report.js');
  Logger.log('as the value of TEMPLATE_ID on line 6.');

  return doc.getId();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function deleteOldTemplate() {
  var folder = DriveApp.getFolderById(BASE_FOLDER_ID);
  var files  = folder.getFilesByName('FortX Site Visit Report — TEMPLATE');
  var count  = 0;
  while (files.hasNext()) {
    files.next().setTrashed(true);
    count++;
  }
  Logger.log('Deleted ' + count + ' old template(s). Now run createTemplate().');
}

function listBaseFolder() {
  var folder = DriveApp.getFolderById(BASE_FOLDER_ID);
  var files  = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    Logger.log(f.getName() + '  ·  ' + f.getId());
  }
}
