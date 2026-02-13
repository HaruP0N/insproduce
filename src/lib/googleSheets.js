// src/lib/googleSheets.js
import { google } from 'googleapis'

/**
 * Cliente de Google Sheets
 */
export class GoogleSheetsClient {
  constructor() {
    this.auth = null
    this.sheets = null
    this.initialized = false
  }

  /**
   * Inicializar cliente con credenciales de service account
   */
  async initialize() {
    if (this.initialized) return

    try {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

      if (!email || !privateKey) {
        throw new Error('Faltan credenciales de Google Sheets en .env.local')
      }

      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: privateKey
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })

      this.sheets = google.sheets({ version: 'v4', auth: this.auth })
      this.initialized = true

      console.log('✅ Google Sheets client initialized')
    } catch (error) {
      console.error('❌ Error initializing Google Sheets:', error)
      throw error
    }
  }

  /**
   * Obtener ID del sheet desde URL
   */
  getSheetIdFromUrl(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : url
  }

  /**
   * Leer datos del sheet
   */
  async readSheet(spreadsheetId, range = 'A:Z') {
    await this.initialize()

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      })

      return response.data.values || []
    } catch (error) {
      console.error('❌ Error reading sheet:', error)
      throw new Error(`Error al leer Google Sheet: ${error.message}`)
    }
  }

  /**
   * Escribir datos en el sheet
   */
  async writeSheet(spreadsheetId, range, values) {
    await this.initialize()

    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values }
      })

      return response.data
    } catch (error) {
      console.error('❌ Error writing sheet:', error)
      throw new Error(`Error al escribir en Google Sheet: ${error.message}`)
    }
  }

  /**
   * Actualizar una celda específica
   */
  async updateCell(spreadsheetId, row, col, value) {
    const columnLetter = this.numberToColumn(col)
    const range = `${columnLetter}${row}`
    return this.writeSheet(spreadsheetId, range, [[value]])
  }

  /**
   * Actualizar múltiples celdas
   */
  async batchUpdate(spreadsheetId, updates) {
    await this.initialize()

    try {
      const data = updates.map(update => ({
        range: update.range,
        values: update.values
      }))

      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data
        }
      })

      return response.data
    } catch (error) {
      console.error('❌ Error batch updating:', error)
      throw new Error(`Error al actualizar celdas: ${error.message}`)
    }
  }

  /**
   * Obtener metadata del sheet
   */
  async getSheetMetadata(spreadsheetId) {
    await this.initialize()

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      })

      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(s => ({
          id: s.properties.sheetId,
          title: s.properties.title,
          index: s.properties.index,
          rowCount: s.properties.gridProperties.rowCount,
          columnCount: s.properties.gridProperties.columnCount
        }))
      }
    } catch (error) {
      console.error('❌ Error getting metadata:', error)
      throw new Error(`Error al obtener metadata: ${error.message}`)
    }
  }

  /**
   * Parsear filas del sheet a objetos
   */
  parseRows(rows) {
    if (!rows || rows.length === 0) return []

    const headers = rows[0].map(h => String(h).trim())
    const dataRows = rows.slice(1)

    return dataRows.map((row, index) => {
      const obj = { _rowNumber: index + 2 } // +2 porque empieza en fila 2 (1 es headers)
      
      headers.forEach((header, colIndex) => {
        obj[header] = row[colIndex] || ''
      })

      return obj
    })
  }

  /**
   * Convertir número de columna a letra (1 = A, 2 = B, etc)
   */
  numberToColumn(num) {
    let column = ''
    while (num > 0) {
      const remainder = (num - 1) % 26
      column = String.fromCharCode(65 + remainder) + column
      num = Math.floor((num - 1) / 26)
    }
    return column
  }

  /**
   * Convertir letra de columna a número (A = 1, B = 2, etc)
   */
  columnToNumber(column) {
    let num = 0
    for (let i = 0; i < column.length; i++) {
      num = num * 26 + (column.charCodeAt(i) - 64)
    }
    return num
  }
}

// Singleton instance
export const sheetsClient = new GoogleSheetsClient()