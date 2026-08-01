'use client'
import { useState } from 'react'
import {
  ClipboardCheck, Users, FileText, Boxes, Plus, Search, Bell, Trash2, Pencil, Leaf,
} from 'lucide-react'
import {
  Button, Card, CardHeader, CardBody, Badge, ResolutionBadge, StatusBadge, PdfBadge,
  StatCard, Avatar, Spinner, Skeleton, EmptyState, Input, Textarea, Select, Field,
  Table, THead, TH, TBody, TR, TD, Modal, Tabs, useToast,
} from '@/components/ui'

export default function UiKit() {
  const [modal, setModal] = useState(false)
  const [tab, setTab] = useState('inspecciones')
  const t = useToast()

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Leaf className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-medium">Insproduce — sistema de diseño</h1>
          <p className="text-sm text-zinc-500">Componentes base del rediseño (enterprise verde)</p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Botones</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary"><Plus className="h-4 w-4" />Nueva inspección</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="subtle">Sutil</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger"><Trash2 className="h-4 w-4" />Eliminar</Button>
          <Button variant="primary" loading>Guardando</Button>
          <Button variant="secondary" size="sm">Chico</Button>
          <Button variant="secondary" size="icon" aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">KPIs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Inspecciones" value="3" hint="+2 vs anterior" trend="up" icon={ClipboardCheck} />
          <StatCard label="Score promedio" value="90.3" hint="sobre 100" icon={FileText} />
          <StatCard label="Tasa de rechazo" value="33%" hint="1 de 3" trend="down" icon={Boxes} />
          <StatCard label="Asignaciones" value="1" hint="activas" icon={Users} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ResolutionBadge value="approved" /><ResolutionBadge value="conditional" /><ResolutionBadge value="rejected" />
          <StatusBadge value="pendiente" /><StatusBadge value="completada" /><StatusBadge value="cancelada" />
          <PdfBadge value="OK" /><PdfBadge value="PENDING" /><PdfBadge value="ERROR" />
          <Badge tone="brand">Arándano</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Tabs + Toasts + Modal</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs items={[{ key: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck }, { key: 'trabajadores', label: 'Trabajadores', icon: Users }]} value={tab} onChange={setTab} />
          <Button variant="secondary" onClick={() => t.success('Inspección guardada')}>Toast éxito</Button>
          <Button variant="secondary" onClick={() => t.error('No se pudo conectar')}>Toast error</Button>
          <Button variant="primary" onClick={() => setModal(true)}>Abrir modal</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Formulario</h2>
        <Card>
          <CardBody className="grid md:grid-cols-2 gap-4">
            <Field label="Productor" htmlFor="p"><Input id="p" placeholder="Berries Premium SpA" /></Field>
            <Field label="Commodity"><Select defaultValue="BLUEBERRY"><option>BLUEBERRY</option><option>STRAWBERRY</option></Select></Field>
            <Field label="Notas" className="md:col-span-2"><Textarea placeholder="Observaciones…" /></Field>
            <Field label="Lote" error="Campo obligatorio"><Input invalid placeholder="LOTE-…" /></Field>
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Tabla</h2>
        <Card className="overflow-hidden">
          <CardHeader title="Inspecciones recientes" icon={ClipboardCheck}
            action={<div className="flex items-center gap-2 text-zinc-400 text-sm"><Search className="h-4 w-4" /><Bell className="h-4 w-4" /></div>} />
          <Table>
            <THead><TH>Fecha</TH><TH>Lote / productor</TH><TH className="text-right">Score</TH><TH>Resolución</TH><TH>PDF</TH></THead>
            <TBody>
              <TR><TD>17/02</TD><TD><div className="font-medium text-zinc-900">LOTE-BLU-2024-001</div><div className="text-xs text-zinc-400">Berries Premium · Arándano</div></TD><TD className="text-right font-medium tabular-nums">92.5</TD><TD><ResolutionBadge value="approved" /></TD><TD><PdfBadge value="OK" /></TD></TR>
              <TR><TD>23/02</TD><TD><div className="font-medium text-zinc-900">LOTE-BLU-2025-001</div><div className="text-xs text-zinc-400">Agrícola Valle Sur · Arándano</div></TD><TD className="text-right font-medium tabular-nums">82.5</TD><TD><ResolutionBadge value="conditional" /></TD><TD><PdfBadge value="OK" /></TD></TR>
              <TR><TD>05/03</TD><TD><div className="font-medium text-zinc-900">AF26007RB</div><div className="text-xs text-zinc-400">Family Tree Farms · Arándano</div></TD><TD className="text-right font-medium tabular-nums">0</TD><TD><ResolutionBadge value="rejected" /></TD><TD><PdfBadge value="PENDING" /></TD></TR>
            </TBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Estados</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Card><CardBody className="flex items-center gap-3"><Spinner /><span className="text-sm text-zinc-500">Cargando…</span></CardBody></Card>
          <Card><CardBody className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></CardBody></Card>
          <Card><EmptyState icon={ClipboardCheck} title="Sin inspecciones" description="Aún no hay registros." action={<Button variant="primary" size="sm"><Plus className="h-4 w-4" />Crear</Button>} /></Card>
        </div>
      </section>

      <Modal open={modal} onClose={() => setModal(false)} title="Crear usuario" subtitle="Alta de un nuevo trabajador"
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setModal(false); t.success('Usuario creado') }}>Crear</Button></>}>
        <div className="space-y-4">
          <Field label="Nombre completo"><Input placeholder="Juan Pérez" /></Field>
          <Field label="Email" required><Input type="email" placeholder="juan@insproduce.cl" /></Field>
          <Field label="Rol"><Select><option>Inspector</option><option>Admin</option></Select></Field>
        </div>
      </Modal>
    </div>
  )
}
