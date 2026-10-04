function setupExecutiveSheetBanner() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  sheets.forEach(function(sheet) {
    sheet.setRowHeight(1, 40);
    sheet.setRowHeight(2, 22);
    
    // Main Title Header
    var titleRange = sheet.getRange("A1:G1");
    titleRange.merge();
    titleRange.setValue("SRI HARSHITHA CONSTRUCTIONS — DEVI KRISHNA VILLA");
    titleRange.setBackground("#0F172A");
    titleRange.setFontColor("#F59E0B");
    titleRange.setFontWeight("bold");
    titleRange.setFontSize(13);
    titleRange.setHorizontalAlignment("center");
    titleRange.setVerticalAlignment("middle");
    
    // Sub-title
    var subRange = sheet.getRange("A2:G2");
    subRange.merge();
    subRange.setValue("KOMMADI, VISAKHAPATNAM  |  AP-RERA REGISTRATION APPROVED  |  MASTER AUDIT LEDGER");
    subRange.setBackground("#1E293B");
    subRange.setFontColor("#94A3B8");
    subRange.setFontWeight("bold");
    subRange.setFontSize(9);
    subRange.setHorizontalAlignment("center");
    subRange.setVerticalAlignment("middle");
    
    sheet.setFrozenRows(4);
  });
}