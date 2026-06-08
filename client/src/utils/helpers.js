/**
 * Format a date string to a readable format
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} formatted date
 */
export const formatDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get month name
 * @param {number} month - 1-12
 * @returns {string} month name
 */
export const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Guard against NaN, undefined, null, out of bounds
  if (typeof month !== 'number' || month < 1 || month > 12) return '';
  return months[month - 1];
};

/**
 * Get short month name
 * @param {number} month - 1-12
 * @returns {string} short month name
 */
export const getShortMonthName = (month) => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[month - 1];
};

/**
 * Get day names
 * @returns {string[]} day names
 */
export const getDayNames = () => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
};

/**
 * Get the number of days in a month
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {number} days in month
 */
export const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * Get the first day of month (0 = Sunday, 1 = Monday, etc.)
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {number} day of week
 */
export const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month - 1, 1).getDay();
};

/**
 * Get heatmap color based on percentage
 * @param {number} percentage - 0-100
 * @returns {string} color hex
 */
export const getHeatmapColor = (percentage) => {
  if (percentage === 0) return 'transparent';
  if (percentage <= 25) return '#1a4a1a';
  if (percentage <= 50) return '#2d8a2d';
  if (percentage <= 75) return '#4caf4c';
  return '#6fcf6f';
};

/**
 * Export data as PDF
 * @param {string} elementId - DOM element to capture
 * @param {string} filename - output filename
 */
export const exportToPDF = async (elementId, filename = 'productivity-report.pdf') => {
  const html2canvas = (await import('html2canvas')).default;
  const jsPDF = (await import('jspdf')).default;
  
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
};

/**
 * Download blob as file
 * @param {Blob} blob
 * @param {string} filename
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};