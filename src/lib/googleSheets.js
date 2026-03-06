// src/lib/googleSheets.js
import { google } from 'googleapis'

export class GoogleSheetsClient {
  constructor() {
    this.auth        = null
    this.sheets      = null
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!email || !privateKey)
      throw new Error('Faltan credenciales de Google Sheets en .env.local')

    this.auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    this.sheets      = google.sheets({ version: 'v4', auth: this.auth })
    this.initialized = true
  }

  getSheetIdFromUrl(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : url
  }

  async readSheet(spreadsheetId, range = 'A:Z') {
    await this.initialize()
    try {
      const response = await this.sheets.spreadsheets.values.get({ spreadsheetId, range })
      return response.data.values || []
    } catch (error) {
      throw new Error(`Error al leer Google Sheet: ${error.message}`)
    }
  }

  async writeSheet(spreadsheetId, range, values) {
    await this.initialize()
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId, range, valueInputOption: 'RAW', resource: { values }
      })
      return response.data
    } catch (error) {
      throw new Error(`Error al escribir en Google Sheet: ${error.message}`)
    }
  }

  async updateCell(spreadsheetId, row, col, value) {
    const columnLetter = this.numberToColumn(col)
    return this.writeSheet(spreadsheetId, `${columnLetter}${row}`, [[value]])
  }

  async batchUpdate(spreadsheetId, updates) {
    await this.initialize()
    try {
      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: { valueInputOption: 'RAW', data: updates.map(u => ({ range: u.range, values: u.values })) }
      })
      return response.data
    } catch (error) {
      throw new Error(`Error al actualizar celdas: ${error.message}`)
    }
  }

  async getSheetMetadata(spreadsheetId) {
    await this.initialize()
    try {
      const response = await this.sheets.spreadsheets.get({ spreadsheetId })
      return {
        title:  response.data.properties.title,
        sheets: response.data.sheets.map(s => ({
          id:          s.properties.sheetId,
          title:       s.properties.title,
          index:       s.properties.index,
          rowCount:    s.properties.gridProperties.rowCount,
          columnCount: s.properties.gridProperties.columnCount
        }))
      }
    } catch (error) {
      throw new Error(`Error al obtener metadata: ${error.message}`)
    }
  }

  parseRows(rows) {
    if (!rows?.length) return []
    const headers  = rows[0].map(h => String(h).trim())
    return rows.slice(1).map((row, index) => {
      const obj = { _rowNumber: index + 2 }
      headers.forEach((header, colIndex) => { obj[header] = row[colIndex] || '' })
      return obj
    })
  }

  numberToColumn(num) {
    let column = ''
    while (num > 0) {
      const remainder = (num - 1) % 26
      column = String.fromCharCode(65 + remainder) + column
      num    = Math.floor((num - 1) / 26)
    }
    return column
  }

  columnToNumber(column) {
    let num = 0
    for (let i = 0; i < column.length; i++) num = num * 26 + (column.charCodeAt(i) - 64)
    return num
  }
}

export const sheetsClient = new GoogleSheetsClient()