'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { Modal, ConfirmDialog, Field, RowAction, ScreenState } from './_ui'
import { listUsers, createUser, updateUser, setUserActive, deleteUser } from '@/lib/adminCrud'

function UserModal({ user, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const editing = !!user
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'inspector', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return onToast({ title: t('common.missingData'), sub: t('users.needNameEmail'), bad: true })
    if (!editing && !form.password) return onToast({ title: t('common.missingData'), sub: t('users.needPassword'), bad: true })
    setBusy(true)
    try {
      if (editing) {
        const body = { name: form.name, email: form.email, role: form.role }
        if (form.password) body.password = form.password
        await updateUser(user.id, body)
      } else {
        await createUser(form)
      }
      onToast({ title: editing ? t('users.updated') : t('users.created'), sub: form.email })
      onSaved()
    } catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={editing ? t('users.edit') : t('users.new')} icon="user" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}</button>
      </>}>
      <Field label={t('tbl.nombre')} required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('users.namePh')} /></Field>
      <Field label={t('tbl.email')} required><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="persona@insproduce.cl" /></Field>
      <Field label={t('tbl.rol')} required>
        <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="admin">{t('users.roleAdmin')}</option>
          <option value="inspector">{t('users.roleInspector')}</option>
        </select>
      </Field>
      <Field label={editing ? t('users.newPassword') : t('users.password')} required={!editing} help={editing ? t('users.helpPwdEdit') : t('users.helpPwdNew')}>
        <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={editing ? '••••••••' : t('users.password')} autoComplete="new-password" />
      </Field>
    </Modal>
  )
}

export default function UsuariosScreen({ onToast, currentUser }) {
  const { t } = useI18n()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listUsers().then(setUsers).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return term ? users.filter(u => (u.name + u.email + u.role).toLowerCase().includes(term)) : users
  }, [users, q])

  const toggleActive = async (u) => {
    setBusyId(u.id)
    try { await setUserActive(u.id, !u.active); setUsers(list => list.map(x => x.id === u.id ? { ...x, active: !u.active } : x)) }
    catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }

  const doDelete = async () => {
    const u = confirm.user
    setBusyId(u.id)
    try { await deleteUser(u.id); onToast({ title: t('users.deleted'), sub: u.email }); setConfirm(null); load() }
    catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <div className="search">
          <Icon name="search" size={16} /><input placeholder={t('users.search')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />{t('users.new')}</button>
      </div>

      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="users" emptyText={t('users.empty')}>
          <table className="tbl">
            <thead><tr><th>{t('tbl.nombre')}</th><th>{t('tbl.email')}</th><th>{t('tbl.rol')}</th><th>{t('tbl.estado')}</th><th></th></tr></thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="cell-strong">{u.name}</td>
                  <td className="mono" style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{u.email}</td>
                  <td><span className="pill-tag"><Icon name={u.role === 'admin' ? 'sliders' : 'clipboard'} size={12} />{u.role === 'admin' ? t('users.roleAdmin') : t('users.roleInspector')}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <button className={'switch' + (u.active ? ' on' : '')} disabled={busyId === u.id} onClick={() => toggleActive(u)} title={u.active ? t('common.active') : t('common.inactive')} />
                      <span style={{ fontSize: 12, color: u.active ? 'var(--green)' : 'var(--text-faint)' }}>{u.active ? t('common.active') : t('common.inactive')}</span>
                    </span>
                  </td>
                  <td style={{ width: 90 }}>
                    <span className="row-actions">
                      <RowAction icon="edit" title={t('common.edit')} onClick={() => setModal({ user: u })} />
                      {u.id !== currentUser?.id && <RowAction icon="trash" title={t('common.delete')} danger onClick={() => setConfirm({ user: u })} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScreenState>
      </Card>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>{t('users.count', { n: rows.length })}</div>

      {modal && <UserModal user={modal.user} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}
      {confirm && <ConfirmDialog title={t('users.delTitle')} danger busy={busyId === confirm.user.id}
        message={t('users.delMsg', { name: confirm.user.name, email: confirm.user.email })}
        confirmLabel={t('common.delete')} onConfirm={doDelete} onClose={() => setConfirm(null)} />}
    </div>
  )
}
