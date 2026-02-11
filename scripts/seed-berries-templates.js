// scripts/seed-berries-templates.js
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import sql from 'mssql'

// 🔧 CARGAR .env.local explícitamente
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../.env.local') })

// 🔍 DEBUG: Verificar que se cargaron las variables
console.log('📋 Variables de entorno:')
console.log('  DB_SERVER:', process.env.DB_SERVER || '❌ NO DEFINIDO')
console.log('  DB_DATABASE:', process.env.DB_DATABASE || '❌ NO DEFINIDO')
console.log('  DB_USER:', process.env.DB_USER || '❌ NO DEFINIDO')
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ (oculta)' : '❌ NO DEFINIDO')
console.log('')

const berriesTemplates = {
  BLUEBERRY: {
    name: 'Standard Blueberries',
    version: 1,
    fields: [
      // Quality defects
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.contamination', label: 'Contamination (%)', field_type: 'number' },
      { key: 'quality.size_note', label: 'Size (nota 1-3)', field_type: 'select', options: ['1', '2', '3'] },
      { key: 'quality.size_consistency_note', label: 'Size Consistency (nota 1-2)', field_type: 'select', options: ['1', '2'] },
      { key: 'quality.bloom_pct', label: 'Bloom (%)', field_type: 'number' },
      { key: 'quality.russet_scars', label: 'Russet/Scars (%)', field_type: 'number' },
      { key: 'quality.no_bloom', label: 'No/Low Bloom (%)', field_type: 'number' },
      { key: 'quality.attached_stems', label: 'Attached Stems (%)', field_type: 'number' },
      { key: 'quality.flower_remains', label: 'Flower Remains (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },
      { key: 'quality.lack_of_color', label: 'Lack of Color (%)', field_type: 'number' },

      // Condition / defects
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.decay_incidence', label: 'Decay Incidence (0-10)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.mold_incidence', label: 'Mold Incidence (0-10)', field_type: 'number' },
      { key: 'condition.mold_type', label: 'Mold Type', field_type: 'select', options: ['Spot', 'Nest', 'Other'] },

      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.sensitive', label: 'Sensitive (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.broken_skin', label: 'Broken Skin (%)', field_type: 'number' },
      { key: 'condition.wounds', label: 'Wounds (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' }
    ]
  },

  BLACKBERRY: {
    name: 'Standard Blackberries',
    version: 1,
    fields: [
      { key: 'quality.immature', label: 'Immature (%)', field_type: 'number' },
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.white_cells', label: 'White Cells (%)', field_type: 'number' },
      { key: 'quality.green_tip', label: 'Green Tip (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.sensitive', label: 'Sensitive (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.red_cells', label: 'Red Cells (%)', field_type: 'number' },
      { key: 'condition.dry_cells', label: 'Dry Cells (%)', field_type: 'number' },
      { key: 'condition.leaking', label: 'Leaking (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.overripe', label: 'Overripe (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  },

  RASPBERRY: {
    name: 'Standard Raspberries',
    version: 1,
    fields: [
      { key: 'quality.inmature', label: 'Inmature (%)', field_type: 'number' },
      { key: 'quality.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'quality.white_cells', label: 'White Cells (%)', field_type: 'number' },
      { key: 'quality.broken_cells', label: 'Broken Cells (%)', field_type: 'number' },

      { key: 'condition.water_cells', label: 'Water Cells (%)', field_type: 'number' },
      { key: 'condition.sun_burn', label: 'Sun Burn (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.leaking', label: 'Leaking (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.overripe_too_dark', label: 'Overripe / Too Dark (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  },

  STRAWBERRY: {
    name: 'Standard Strawberries',
    version: 1,
    fields: [
      { key: 'pack.underweight', label: 'Underweight (%)', field_type: 'number' },
      { key: 'quality.size', label: 'Size', field_type: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'quality.poorly_colored', label: 'Poorly Colored (%)', field_type: 'number' },
      { key: 'quality.poorly_cleanliness', label: 'Poorly Cleanliness (%)', field_type: 'number' },
      { key: 'quality.no_calyx', label: 'No Calyx (%)', field_type: 'number' },
      { key: 'quality.dry_calyx', label: 'Dry Calyx (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.misshapen', label: 'Misshapen (%)', field_type: 'number' },
      { key: 'condition.soft_overripe', label: 'Soft / Overripe (%)', field_type: 'number' },
      { key: 'condition.cuts', label: 'Cuts (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.bruises', label: 'Bruises (%)', field_type: 'number' }
    ]
  },

  REDCURRANT: {
    name: 'Standard Red Currants',
    version: 1,
    fields: [
      // Quality defects
      { key: 'quality.immature', label: 'Immature (%)', field_type: 'number' },
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.scars', label: 'Scars (%)', field_type: 'number' },
      { key: 'quality.russet', label: 'Russet (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      // Stem condition (nota 1-3, solo para comentario)
      { key: 'quality.stem_condition', label: 'Stem Condition (nota 1-3)', field_type: 'select', options: ['1', '2', '3'] },
    
      // Bunches (para comentario, no en planilla)
      { key: 'quality.bunches_length_cm', label: 'Bunches Length (cm)', field_type: 'number' },
      { key: 'quality.bunches_consistency', label: 'Bunches Consistency', field_type: 'select', options: ['Consistent', 'Inconsistent'] },

      // Condition defects
      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.bird_peck', label: 'Bird Peck (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.bruises', label: 'Bruises (%)', field_type: 'number' },
      { key: 'condition.overripe', label: 'Overripe (%)', field_type: 'number' },
      { key: 'condition.splits', label: 'Splits (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  }
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true
  }
}

async function seedTemplates() {
  console.log('🔧 Conectando a:', config.server, '/', config.database)

  if (!config.server || !config.database) {
    console.error('❌ ERROR: Faltan variables de entorno en .env.local')
    process.exit(1)
  }

  let pool
  try {
    pool = await sql.connect(config)
    console.log('✅ Conectado a la base de datos\n')

    for (const [commodityCode, template] of Object.entries(berriesTemplates)) {
      console.log(`🔍 Procesando ${commodityCode}...`)

      try {
        // 1. Buscar commodity
        const cRes = await pool.request()
          .input('code', sql.VarChar(50), commodityCode)
          .query('SELECT id FROM commodities WHERE code = @code')

        if (!cRes.recordset?.[0]) {
          console.log(`❌ Commodity ${commodityCode} no existe en la tabla commodities\n`)
          continue
        }

        const commodityId = cRes.recordset[0].id

        // 2. Verificar si ya existe template
        const tRes = await pool.request()
          .input('commodity_code', sql.VarChar(50), commodityCode)
          .input('version', sql.Int, template.version)
          .query(`SELECT id FROM metric_templates 
                  WHERE commodity_code = @commodity_code AND version = @version`)

        let templateId

        if (tRes.recordset?.[0]) {
          templateId = tRes.recordset[0].id
          console.log(`  ✅ Template ya existe (ID: ${templateId})`)

          // Borrar fields antiguos para re-insertarlos
          await pool.request()
            .input('template_id', sql.Int, templateId)
            .query('DELETE FROM metric_fields WHERE template_id = @template_id')
          console.log(`  🗑️  Fields antiguos eliminados`)
        } else {
          // 3. Crear template nueva
          const insertT = await pool.request()
            .input('commodity_id', sql.Int, commodityId)
            .input('commodity_code', sql.VarChar(50), commodityCode)
            .input('name', sql.VarChar(120), template.name)
            .input('version', sql.Int, template.version)
            .query(`INSERT INTO metric_templates 
                    (commodity_id, commodity_code, name, version, active)
                    OUTPUT INSERTED.id
                    VALUES (@commodity_id, @commodity_code, @name, @version, 1)`)

          templateId = insertT.recordset[0].id
          console.log(`  ✅ Template creada (ID: ${templateId})`)
        }

        // 4. Insertar todos los fields
        for (let i = 0; i < template.fields.length; i++) {
          const field = template.fields[i]

          await pool.request()
            .input('template_id', sql.Int, templateId)
            .input('key', sql.VarChar(80), field.key)
            .input('label', sql.VarChar(120), field.label)
            .input('field_type', sql.VarChar(20), field.field_type)
            .input('required', sql.Bit, field.required || false)
            .input('unit', sql.VarChar(20), field.unit || null)
            .input('min_value', sql.Decimal(18, 2), field.min_value || null)
            .input('max_value', sql.Decimal(18, 2), field.max_value || null)
            // 🔧 CAMBIO CRÍTICO: Siempre '[]' nunca null
            .input('options', sql.NVarChar(sql.MAX), field.options ? JSON.stringify(field.options) : '[]')
            .input('order_index', sql.Int, i)
            .query(`INSERT INTO metric_fields 
                    (template_id, [key], label, field_type, required, unit, 
                     min_value, max_value, options, order_index)
                    VALUES (@template_id, @key, @label, @field_type, @required, 
                            @unit, @min_value, @max_value, @options, @order_index)`)
        }

        console.log(`  ✅ ${template.fields.length} fields insertados\n`)
      } catch (e) {
        console.error(`❌ Error con ${commodityCode}:`, e.message, '\n')
      }
    }

    console.log('🎉 Seed completado exitosamente!')
  } catch (e) {
    console.error('❌ Error de conexión a la base de datos:', e.message)
  } finally {
    if (pool) await pool.close()
    process.exit(0)
  }
}

seedTemplates()