/**
 * Creates an executive Sri Harshitha Constructions Banner with Logo across all tabs
 */
function setupExecutiveSheetBanner() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  // Direct Public URL of the SHC Logo
  var logoUrl = "https://i.imgur.com/your-shc-logo.png"; 

  sheets.forEach(function(sheet) {
    sheet.insertRowsBefore(1, 3);
    
    sheet.setRowHeight(1, 40);
    sheet.setRowHeight(2, 22);
    sheet.setRowHeight(3, 10);
    
    // Main Title Header
    var titleRange = sheet.getRange("B1:H1");
    titleRange.merge();
    titleRange.setValue("SRI HARSHITHA CONSTRUCTIONS — DEVI KRISHNA VILLA");
    titleRange.setBackground("#FF9900");
    titleRange.setFontColor("#000000");
    titleRange.setFontWeight("bold");
    titleRange.setFontSize(14);
    titleRange.setHorizontalAlignment("center");
    titleRange.setVerticalAlignment("middle");
    
    // Sub-title with AP-RERA Credentials
    var subRange = sheet.getRange("B2:H2");
    subRange.merge();
    subRange.setValue("KOMMADI, VISAKHAPATNAM  |  AP-RERA REGISTRATION APPROVED  |  OFFICIAL PROJECT LEDGER");
    subRange.setBackground("#0F172A");
    subRange.setFontColor("#F8FAFC");
    subRange.setFontWeight("bold");
    subRange.setFontSize(9);
    subRange.setHorizontalAlignment("center");
    subRange.setVerticalAlignment("middle");
    
    // SHC Logo Box
    var logoCell = sheet.getRange("A1");
    logoCell.setFormula('=IMAGE("' + logoUrl + '", 1)');
    sheet.getRange("A1:A2").merge().setBackground("#FF9900");
  });
}