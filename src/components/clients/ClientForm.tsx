'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Client, ClientStatus, InsertDto, UpdateDto } from '@/types/database.types'

interface ClientFormProps {
  mode: 'create' | 'edit'
  initialData?: Client
}

interface FormErrors {
  company_name?: string
  contact_email?: string
}

export function ClientForm({ mode, initialData }: ClientFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState(initialData?.company_name ?? '')
  const [clientName, setClientName] = useState(initialData?.client_name ?? '')
  const [businessUnit, setBusinessUnit] = useState(initialData?.business_unit ?? '')
  const [segment, setSegment] = useState(initialData?.segment ?? '')
  const [contactEmail, setContactEmail] = useState(initialData?.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initialData?.contact_phone ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [status, setStatus] = useState<ClientStatus>(initialData?.status ?? 'active')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function validate() {
    const nextErrors: FormErrors = {}

    if (!companyName.trim()) {
      nextErrors.company_name = 'Informe a razão social ou nome da empresa.'
    }

    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      nextErrors.contact_email = 'Informe um e-mail válido.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setSaving(true)

    const companyNameValue = companyName.trim()
    const clientNameValue = clientName.trim() || null
    const businessUnitValue = businessUnit.trim() || null
    const segmentValue = segment.trim() || null
    const contactEmailValue = contactEmail.trim().toLowerCase() || null
    const contactPhoneValue = contactPhone.trim() || null
    const notesValue = notes.trim() || null

    const updatePayload: UpdateDto<'clients'> = {
      company_name: companyNameValue,
      client_name: clientNameValue,
      business_unit: businessUnitValue,
      segment: segmentValue,
      contact_email: contactEmailValue,
      contact_phone: contactPhoneValue,
      notes: notesValue,
      status,
    }

    try {
      const clientsTable = supabase.from('clients') as any

      if (mode === 'create') {
        const { data: authData } = await supabase.auth.getUser()
        const insertPayload: InsertDto<'clients'> = {
          company_name: companyNameValue,
          client_name: clientNameValue,
          business_unit: businessUnitValue,
          segment: segmentValue,
          contact_email: contactEmailValue,
          contact_phone: contactPhoneValue,
          notes: notesValue,
          status,
          created_by: authData.user?.id ?? null,
        }

        const { data, error } = await clientsTable
          .insert({
            ...insertPayload,
          })
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível criar o cliente.')
        }

        router.push(`/dashboard/clientes/${(data as { id: string }).id}`)
      } else if (initialData) {
        const { data, error } = await clientsTable
          .update(updatePayload)
          .eq('id', initialData.id)
          .select('id')
          .single()

        if (error || !data) {
          throw new Error(error?.message ?? 'Não foi possível atualizar o cliente.')
        }

        router.push(`/dashboard/clientes/${(data as { id: string }).id}`)
      }

      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o cliente. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="company_name" className="label">
            Empresa *
          </label>
          <input
            id="company_name"
            value={companyName}
            onChange={event => setCompanyName(event.target.value)}
            className="input"
            placeholder="Ex.: Transportes Aurora S.A."
            disabled={saving}
          />
          {errors.company_name && <p className="mt-1 text-xs text-red-600">{errors.company_name}</p>}
        </div>

        <div>
          <label htmlFor="client_name" className="label">
            Nome do contato principal
          </label>
          <input
            id="client_name"
            value={clientName}
            onChange={event => setClientName(event.target.value)}
            className="input"
            placeholder="Ex.: Mariana Costa"
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="business_unit" className="label">
            Unidade de negócio
          </label>
          <input
            id="business_unit"
            value={businessUnit}
            onChange={event => setBusinessUnit(event.target.value)}
            className="input"
            placeholder="Ex.: Operações"
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="segment" className="label">
            Segmento
          </label>
          <input
            id="segment"
            value={segment}
            onChange={event => setSegment(event.target.value)}
            className="input"
            placeholder="Ex.: Logística"
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={event => setStatus(event.target.value as ClientStatus)}
            className="input"
            disabled={saving}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>

        <div>
          <label htmlFor="contact_email" className="label">
            E-mail de contato
          </label>
          <input
            id="contact_email"
            type="email"
            value={contactEmail}
            onChange={event => setContactEmail(event.target.value)}
            className="input"
            placeholder="contato@empresa.com.br"
            disabled={saving}
          />
          {errors.contact_email && <p className="mt-1 text-xs text-red-600">{errors.contact_email}</p>}
        </div>

        <div>
          <label htmlFor="contact_phone" className="label">
            Telefone de contato
          </label>
          <input
            id="contact_phone"
            value={contactPhone}
            onChange={event => setContactPhone(event.target.value)}
            className="input"
            placeholder="(11) 99999-0000"
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="notes" className="label">
            Observações
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            className="input min-h-28 resize-y"
            placeholder="Anotações relevantes sobre a conta, contexto comercial ou particularidades do cliente."
            disabled={saving}
          />
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={initialData ? `/dashboard/clientes/${initialData.id}` : '/dashboard/clientes'}
          className="btn-secondary"
        >
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {mode === 'create' ? 'Criar cliente' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
