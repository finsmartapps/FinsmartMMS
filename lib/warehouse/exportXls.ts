function escapeXml(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Sheet {
  name: string
  headers: string[]
  rows: (string | number | null)[][]
}

function buildSheet(name: string, headers: string[], rows: (string | number | null)[][]): string {
  const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')
  const dataRows = rows.map(row =>
    `<Row>${row.map(cell => {
      const isNum = typeof cell === 'number'
      return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`
    }).join('')}</Row>`
  ).join('\n')
  return `<Worksheet ss:Name="${escapeXml(name)}">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>`
}

export function downloadXls(sheets: Sheet[], filename: string): void {
  const worksheets = sheets.map(s => buildSheet(s.name, s.headers, s.rows)).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Default">
      <Alignment ss:WrapText="0"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
