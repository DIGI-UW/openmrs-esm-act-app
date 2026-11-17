/** A cell starting with =, +, -, @, a tab or a carriage return gets a leading ' so a spreadsheet shows it as text. */
function csvCell(text: string) {
  const value = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Downloads rows as a CSV file, one line per row with the given headers first. */
export function downloadCsv(fileName: string, headers: Array<string>, rows: Array<Array<string>>) {
  const csv = [headers, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
