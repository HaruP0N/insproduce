'use client'
import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Field } from './_ui'
import { useI18n } from '@/lib/i18n'
import { commodityVisual } from '@/lib/inspectorData'
import { parseBulkRows, HEADER_COLUMNS } from '@/lib/bulkImport'

const PREVIEW_ROWS = 8

export default function CargaMasivaScreen({ onToast, onDone }) {
  const { t, lang } = useI18n()
  const [commodities, setCommodities] = useState([])
  const [code, setCode] = useState('BLUEBERRY')
  const [fields, setFields] = useState([])
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/commodities', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCommodities(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!code) return
    setFields([]); setParsed(null); setFile(null); setResult(null)
    fetch(`/api/metric-templates/code/${code}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setFields(Array.isArray(d.fields) ? d.fields : []))
      .catch(() => {})
  }, [code])

  const handleFile = async (f) => {
    if (!f) return
    setFile(f); setResult(null); setBusy(true)
    try {
      // El Excel se lee AQUÍ (navegador): así se previsualiza antes de tocar la base
      const XLSX = (await import('xlsx')).default || (await import('xlsx'))
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { cellDates: true, type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        .filter(r => !String(r[HEADER_COLUMNS[0].es] ?? r[HEADER_COLUMNS[0].en] ?? '')
          .toUpperCase().startsWith(lang === 'en' ? 'EXAMPLE' : 'EJEMPLO'))
      setParsed(parseBulkRows(raw, fields, code))
    } catch (e) {
      onToast({ title: t('bulk.errRead'), sub: e.message, bad: true })
      setFile(null); setParsed(null)
    } finally {
      setBusy(false)
    }
  }

  const importar = async () => {
    if (!parsed?.rows.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/inspecciones/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.rows }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || t('bulk.errImport'))
      setResult(data)
      onToast({
        title: t('bulk.done', { n: data.created }),
        sub: data.failed ? t('bulk.someFailed', { n: data.failed }) : undefined,
        bad: data.created === 0,
      })
      if (data.created > 0) onDone?.()
    } catch (e) {
      onToast({ title: t('bulk.errImport'), sub: e.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setParsed(null); setResult(null) }
  const metricCols = fields.length

  return (
    <div className="content-inner fade-up">
      <div className="grid cols-2-1" style={{ alignItems: 'start' }}>
        <Card title={t('bulk.title')} sub={t('bulk.sub')}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ minWidth: 190, flex: 1 }}>
              <Field label={t('ni.commodity')}>
                <select className="select" value={code} onChange={e => setCode(e.target.value)}>
                  {commodities.map(c => (
                    <option key={c.code} value={c.code}>{commodityVisual(c.code, t).label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <a className="btn" style={{ marginBottom: 14 }}
              href={`/api/inspecciones/bulk/template?commodity=${code}&lang=${lang}`}>
              <Icon name="download" size={15} />{t('bulk.downloadTpl')}
            </a>
          </div>

          <div
            className={`dropzone-qc ${over ? 'over' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]) }}
          >
            <Icon name="download" size={26} style={{ transform: 'rotate(180deg)', color: 'var(--accent)' }} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>{file ? file.name : t('bulk.drop')}</div>
            <div className="form-help">{file ? t('bulk.changeFile') : t('bulk.dropSub')}</div>
            <input ref={inputRef} type="file" hidden accept=".xlsx,.xlsm,.xls"
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          {parsed && !result && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <span className="badge good">{t('bulk.ready', { n: parsed.rows.length })}</span>
                {parsed.errors.length > 0 && <span className="badge warn">{t('bulk.withErrors', { n: parsed.errors.length })}</span>}
                {parsed.unknownColumns.length > 0 && (
                  <span className="badge neutral" title={parsed.unknownColumns.join(', ')}>
                    {t('bulk.ignoredCols', { n: parsed.unknownColumns.length })}
                  </span>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <div className="form-help" style={{ marginTop: 10, color: 'var(--red)' }}>
                  {parsed.errors.slice(0, 5).map(e => `Fila ${e.row}: ${e.msg}`).join(' · ')}
                  {parsed.errors.length > 5 && ` … +${parsed.errors.length - 5}`}
                </div>
              )}

              {parsed.rows.length > 0 && (
                <div style={{ marginTop: 14, overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead><tr>
                      <th>#</th><th>{t('tbl.productor')}</th><th>{t('ni.lot')}</th>
                      <th>{t('tbl.variedad')}</th><th className="num">{t('bulk.metricsFilled')}</th>
                    </tr></thead>
                    <tbody>
                      {parsed.rows.slice(0, PREVIEW_ROWS).map(r => (
                        <tr key={r.__row}>
                          <td className="mono" style={{ color: 'var(--text-faint)' }}>{r.__row}</td>
                          <td className="cell-strong">{r.producer}</td>
                          <td className="mono" style={{ fontSize: 12.5 }}>{r.lot}</td>
                          <td style={{ color: 'var(--text-dim)' }}>{r.variety || '—'}</td>
                          <td className="num">{Object.keys(r.metrics).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > PREVIEW_ROWS && (
                    <div className="form-help" style={{ marginTop: 8 }}>
                      {t('bulk.andMore', { n: parsed.rows.length - PREVIEW_ROWS })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn" onClick={reset} disabled={busy}>{t('common.cancel')}</button>
                <button className="btn btn-primary" onClick={importar} disabled={busy || !parsed.rows.length}>
                  <Icon name="check" size={15} />
                  {busy ? t('bulk.importing') : t('bulk.import', { n: parsed.rows.length })}
                </button>
              </div>
            </>
          )}

          {result && (
            <div style={{ marginTop: 16 }}>
              <div className="badge good" style={{ fontSize: 13 }}>
                <Icon name="checkCircle" size={14} />{t('bulk.done', { n: result.created })}
              </div>
              {result.failed > 0 && (
                <div className="form-help" style={{ marginTop: 10, color: 'var(--red)' }}>
                  {result.details.failed.slice(0, 5).map(f => `Fila ${f.row}: ${f.msg}`).join(' · ')}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <button className="btn" onClick={reset}>{t('bulk.another')}</button>
              </div>
            </div>
          )}
        </Card>

        <Card title={t('bulk.howTitle')}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75, color: 'var(--text-dim)' }}>
            <li>{t('bulk.step1')}</li>
            <li>{t('bulk.step2')}</li>
            <li>{t('bulk.step3')}</li>
            <li>{t('bulk.step4')}</li>
          </ol>
          <div className="form-help" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {t('bulk.colsInfo', { h: HEADER_COLUMNS.length, m: metricCols })}
          </div>
        </Card>
      </div>
    </div>
  )
}
