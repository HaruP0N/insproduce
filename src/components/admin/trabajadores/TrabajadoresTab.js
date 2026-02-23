'use client'

import { useState, useEffect } from 'react'
import { S } from '@/lib/admin'
import { Button } from '@/components/admin/shared'

// ─── TrabajadoresTab ──────────────────────────────────────────────────────────

export default function TrabajadoresTab() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen]     = useState(false)
  const [editUser, setEditUser]     = useState(null)

  const [newUser, setNewUser]   = useState({ name: '', email: '', password: '', role: 'inspector' })
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '' })
  const [saving, setSaving]     = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(res.status === 401 || res.status === 403 ? 'Sin permisos de admin.' : d?.msg || `Error ${res.status}`)
        setUsuarios([])
        return
      }
      const data = await res.json()
      setUsuarios(Array.isArray(data) ? data.map(u => ({ ...u, active: Boolean(u.active) })) : [])
    } catch (err) {
      setError('Error: ' + err.message)
      setUsuarios([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res  = await fetch('/api/users', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error')
      alert('✅ Usuario creado')
      setCreateOpen(false)
      setNewUser({ name: '', email: '', password: '', role: 'inspector' })
      fetchUsers()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!editUser?.id) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error')
      alert('✅ Actualizado')
      setEditOpen(false)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    if (!confirm(`¿${u.active ? 'Desactivar' : 'Activar'} a ${u.email}?`)) return
    try {
      const res  = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div style={{ padding: 52, textAlign: 'center', color: '#9ca3af' }}>⏳ Cargando…</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626' }}>⚠️ {error}</div>
    </div>
  )

  return (
    <div style={{ padding: 18, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ ...S.card, padding: 20, overflow: 'visible' }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: '#15803d', fontSize: 20, fontWeight: 900 }}>Gestión de Trabajadores</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{usuarios.length} usuarios</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>➕ Crear usuario</Button>
        </div>

        {/* Tabla */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['ID', 'Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td style={S.td}>{u.id}</td>
                <td style={S.td}>{u.name || '--'}</td>
                <td style={S.td}>{u.email}</td>
                <td style={S.td}>
                  <span style={{ fontWeight: 700, color: u.role === 'admin' ? '#b45309' : '#15803d' }}>
                    {u.role === 'admin' ? '👑 Admin' : '👷 Inspector'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    background: u.active ? '#f0fdf4' : '#fef2f2',
                    color: u.active ? '#166534' : '#dc2626',
                    border: `1px solid ${u.active ? '#86efac' : '#fca5a5'}`
                  }}>
                    {u.active ? '✅ Activo' : '❌ Inactivo'}
                  </span>
                </td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" small onClick={() => {
                      setEditUser(u)
                      setEditForm({ name: u.name || '', email: u.email || '', role: u.role || '', password: '' })
                      setEditOpen(true)
                    }}>
                      ✏️ Editar
                    </Button>
                    <Button variant={u.active ? 'gray' : 'primary'} small onClick={() => toggleActive(u)}>
                      {u.active ? '🚫 Desactivar' : '✅ Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 32 }}>Sin usuarios</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear usuario */}
      {createOpen && (
        <div style={S.modalOv} onClick={e => e.target === e.currentTarget && setCreateOpen(false)}>
          <div style={S.modalSm}>
            <div style={S.modalHead}>
              <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900 }}>Crear Usuario</h3>
              <Button variant="gray" small onClick={() => setCreateOpen(false)}>✕</Button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={S.modalBody}>
                {[
                  ['name',     'text',     'Nombre completo'],
                  ['email',    'email',    'Email *'],
                  ['password', 'password', 'Contraseña * (mín. 6 caracteres)']
                ].map(([k, t, lbl]) => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.field} type={t} value={newUser[k]}
                      onChange={e => setNewUser(p => ({ ...p, [k]: e.target.value }))}
                      required={k !== 'name'} minLength={k === 'password' ? 6 : undefined}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Rol</label>
                  <select style={S.field} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div style={S.modalFoot}>
                <Button variant="gray" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {editOpen && editUser && (
        <div style={S.modalOv} onClick={e => e.target === e.currentTarget && setEditOpen(false)}>
          <div style={S.modalSm}>
            <div style={S.modalHead}>
              <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900 }}>Editar — {editUser.email}</h3>
              <Button variant="gray" small onClick={() => setEditOpen(false)}>✕</Button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={S.modalBody}>
                {[
                  ['name',     'text',     'Nombre'],
                  ['email',    'email',    'Email'],
                  ['password', 'password', 'Nueva contraseña (opcional)']
                ].map(([k, t, lbl]) => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.field} type={t} value={editForm[k]}
                      onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={k === 'password' ? 'Dejar vacío para no cambiar' : undefined}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Rol</label>
                  <select style={S.field} value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div style={S.modalFoot}>
                <Button variant="gray" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}