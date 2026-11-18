export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const escapeCell = (value: string | number | null | undefined): string => {
    let text = String(value ?? '');

    // Prevent spreadsheet formula injection in untrusted text.
    // Numeric values are not modified.
    if (typeof value === 'string' && /^[\s\u0000-\u001F]*[=+\-@]/u.test(text)) {
      text = `'${text}`;
    }

    // Escape characters required by CSV formatting.
    if (
      text.includes(',') ||
      text.includes('"') ||
      text.includes('\n') ||
      text.includes('\r')
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  return [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');
}
