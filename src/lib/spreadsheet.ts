// Lightweight spreadsheet parser for the rupture import flow.
// Supports CSV (semicolon or comma delimited) and .xlsx (via JSZip + minimal
// XML parsing of the shared strings + first sheet). No external deps beyond jszip.

import JSZip from 'jszip'

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const semis = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  if (semis >= commas && semis > 0) return ';'
  return ','
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        out.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text: string): ParsedSheet {
  const delimiter = detectDelimiter(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim())
  const rows = lines.slice(1).map((l) => parseCsvLine(l, delimiter))
  return { headers, rows }
}

/**
 * Parse an .xlsx file. Reads the shared strings table and the first worksheet,
 * producing a headers + rows structure. Good enough for tabular imports.
 */
export async function parseXlsx(file: File): Promise<ParsedSheet> {
  const zip = await JSZip.loadAsync(file)
  // Shared strings
  const sharedStrings: string[] = []
  const ssFile = zip.file('xl/sharedStrings.xml')
  if (ssFile) {
    const xml = await ssFile.async('string')
    // crude regex parse of <si><t>...</t></si>
    const re = /<si[^>]*>([\s\S]*?)<\/si>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const inner = m[1]
      const texts = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []
      const val = texts
        .map((t) =>
          t
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>'),
        )
        .join('')
      sharedStrings.push(val)
    }
  }

  // Find first sheet — usually xl/worksheets/sheet1.xml
  const sheetFile =
    zip.file(/xl\/worksheets\/sheet1\.xml/)[0] || zip.file(/xl\/worksheets\/sheet.*\.xml/)[0]
  if (!sheetFile) return { headers: [], rows: [] }
  const sheetXml = await sheetFile.async('string')

  // Extract rows: <row ...><c r="A1" t="s"><v>0</v></c>...</row>
  const rows: string[][] = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1]
    const cells: { col: number; val: string }[] = []
    const cellRe =
      /<c\b[^>]*r="([A-Z]+)\d+"[^>]*?(?:\bt="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      const colLetters = cellMatch[1]
      const t = cellMatch[2]
      const v = cellMatch[3] || ''
      let col = 0
      for (let i = 0; i < colLetters.length; i++) {
        col = col * 26 + (colLetters.charCodeAt(i) - 64)
      }
      col -= 1
      let val = v
      if (t === 's') {
        val = sharedStrings[parseInt(v, 10)] || ''
      } else if (t === 'str') {
        val = v
      }
      cells.push({ col, val })
    }
    if (cells.length === 0) continue
    const maxCol = Math.max(...cells.map((c) => c.col))
    const rowArr = new Array(maxCol + 1).fill('')
    for (const c of cells) rowArr[c.col] = c.val
    rows.push(rowArr)
  }

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map((h) => (h || '').trim())
  return { headers, rows: rows.slice(1) }
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCsv(text)
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return await parseXlsx(file)
  }
  // Try CSV as fallback
  const text = await file.text()
  return parseCsv(text)
}
