'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, ConfirmDialog, Field, RowAction, ScreenState } from './_ui'
import { listUsers, createUser, updateUser, setUserActive, deleteUser } from '@/lib/adminCrud'

const ROLES = [{ v: 'admin', l: 'Administrador' }, { v: 'inspector', l: 'Inspector' }]
const roleLabel = (r) => ROLES.find(x => x.v === r)?.l || r

function UserModal({ user, onClose, onSaved, onToast }) {
  const editing = !!user
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'inspector', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return onToast({ title: 'Faltan datos', sub: 'Nombre y email son obligatorios', bad: true })
    if (!editing && !form.password) return onToast({ title: 'Falta contraseña', sub: 'Requerida al crear', bad: true })
    setBusy(true)
    try {
      if (editing) {
        const body = { name: form.name, email: form.email, role: form.role }
        if (form.password) body.password = form.password
        await updateUser(user.id, body)
      } else {
        await createUser(form)
      }
      onToast({ title: editing ? 'Usuario actualizado' : 'Usuario creado', sub: form.email })
      onSaved()
    } catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} icon="user" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <Field label="Nombre" required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre completo" /></Field>
      <Field label="Email" required><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="persona@insproduce.cl" /></Field>
      <Field label="Rol" required>
        <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
          {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </Field>
      <Field label={editing ? 'Nueva contraseña' : 'Contraseña'} required={!editing} help={editing ? 'Dejar en blanco para no cambiarla.' : 'Mínimo recomendado: 8 caracteres.'}>
        <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={editing ? '••••••••' : 'Contraseña'} autoComplete="new-password" />
      </Field>
    </Modal>
  )
}

export default function UsuariosScreen({ onToast, currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)       // null | {user?}
  const [confirm, setConfirm] = useState(null)   // {user}
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listUsers().then(setUsers).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? users.filter(u => (u.name + u.email + u.role).toLowerCase().includes(t)) : users
  }, [users, q])

  const toggleActive = async (u) => {
    setBusyId(u.id)
    try { await setUserActive(u.id, !u.active); setUsers(list => list.map(x => x.id === u.id ? { ...x, active: !u.active } : x)) }
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }

  const doDelete = async () => {
    const u = confirm.user
    setBusyId(u.id)
    try { await deleteUser(u.id); onToast({ title: 'Usuario eliminado', sub: u.email }); setConfirm(null); load() }
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <div className="search">
          <Icon name="search" size={16} /><input placeholder="Buscar usuario…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />Nuevo usuario</button>
      </div>

      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="users" emptyText="No hay usuarios.">
          <table className="tbl">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="cell-strong">{u.name}</td>
                  <td className="mono" style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{u.email}</td>
                  <td><span className="pill-tag"><Icon name={u.role === 'admin' ? 'sliders' : 'clipboard'} size={12} />{roleLabel(u.role)}</span></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <button className={'switch' + (u.active ? ' on' : '')} disabled={busyId === u.id} onClick={() => toggleActive(u)} title={u.active ? 'Activo' : 'Inactivo'} />
                      <span style={{ fontSize: 12, color: u.active ? 'var(--green)' : 'var(--text-faint)' }}>{u.active ? 'Activo' : 'Inactivo'}</span>
                    </span>
                  </td>
                  <td style={{ width: 90 }}>
                    <span className="row-actions">
                      <RowAction icon="edit" title="Editar" onClick={() => setModal({ user: u })} />
                      {u.id !== currentUser?.id && <RowAction icon="trash" title="Eliminar" danger onClick={() => setConfirm({ user: u })} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScreenState>
      </Card>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>{rows.length} usuario(s)</div>

      {modal && <UserModal user={modal.user} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}
      {confirm && <ConfirmDialog title="Eliminar usuario" danger busy={busyId === confirm.user.id}
        message={`¿Eliminar a ${confirm.user.name} (${confirm.user.email})? Se desactivará su acceso (borrado lógico).`}
        confirmLabel="Eliminar" onConfirm={doDelete} onClose={() => setConfirm(null)} />}
    </div>
  )
}
