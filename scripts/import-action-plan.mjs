#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const CSV_PATH = path.join(projectRoot, 'data/imports/Plano_de_Acao_Dede_MOVE_FLOW_import_corrigido.csv')
const CLIENT_NAME = 'Dedé Autopeças'
const PROJECT_NAME = 'Dedé autopeças - Processos Logísticos, WMS e Layout'
const RESPONSIBLE_NAME = 'Manoel Malta Filho'

const REQUIRED_HEADERS = [
  'Cliente',
  'Projeto',
  'ID original',
  'Tópico',
  'Área',
  'Ação',
  'Responsável',
  'Prazo',
  'Data de conclusão',
  'Status',
  'Observações',
  'Status original',
  'Pessoa FAUS original',
  'Pessoa Dedé original',
]

const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run'

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName)
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key]) continue

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const normalized = content.replace(/^\uFEFF/, '')

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ';' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some(value => value.trim() !== '')) rows.push(row)

  return rows
}

function toRecords(rows) {
  const [headers, ...dataRows] = rows
  if (!headers) throw new Error('CSV sem cabeçalho.')

  const normalizedHeaders = headers.map(header => header.trim())
  const missingHeaders = REQUIRED_HEADERS.filter(header => !normalizedHeaders.includes(header))
  if (missingHeaders.length > 0) {
    throw new Error(`CSV sem colunas obrigatórias: ${missingHeaders.join(', ')}`)
  }

  return dataRows.map((row, index) => {
    const record = { __line: index + 2 }
    normalizedHeaders.forEach((header, headerIndex) => {
      record[header] = (row[headerIndex] ?? '').trim()
    })
    return record
  })
}

function parseBrazilianDate(value, fieldName, line) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) {
    throw new Error(`Linha ${line}: ${fieldName} inválida (${value}). Use dd/mm/aaaa.`)
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Linha ${line}: ${fieldName} inválida (${value}).`)
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function normalizeDuplicateKey(title, dueDate) {
  return `${title.trim().replace(/\s+/g, ' ').toLowerCase()}::${dueDate ?? ''}`
}

function buildNotes(record) {
  const notes = []

  if (record['Observações']) {
    notes.push(`Observações do plano:\n${record['Observações']}`)
  }

  notes.push([
    'Dados auxiliares da importação:',
    `- ID original: ${record['ID original'] || 'não informado'}`,
    `- Tópico: ${record['Tópico'] || 'não informado'}`,
    `- Área: ${record['Área'] || 'não informada'}`,
    `- Status original: ${record['Status original'] || record['Status'] || 'não informado'}`,
    `- Responsável original da planilha: ${record['Responsável'] || 'não informado'}`,
    `- Pessoa FAUS original: ${record['Pessoa FAUS original'] || 'não informada'}`,
    `- Pessoa Dedé original: ${record['Pessoa Dedé original'] || 'não informada'}`,
  ].join('\n'))

  return notes.join('\n\n')
}

function prepareRows(records, existingKeys) {
  const validRows = []
  const duplicateRows = []
  const errorRows = []
  const batchKeys = new Set()

  for (const record of records) {
    try {
      if (record['Cliente'] !== CLIENT_NAME) {
        throw new Error(`Linha ${record.__line}: cliente diferente do esperado (${record['Cliente'] || 'vazio'}).`)
      }

      if (record['Projeto'] !== PROJECT_NAME) {
        throw new Error(`Linha ${record.__line}: projeto diferente do esperado (${record['Projeto'] || 'vazio'}).`)
      }

      const title = record['Ação'].trim()
      if (!title) throw new Error(`Linha ${record.__line}: campo Ação vazio.`)

      const dueDate = parseBrazilianDate(record['Prazo'], 'Prazo', record.__line)
      const completionDate = parseBrazilianDate(record['Data de conclusão'], 'Data de conclusão', record.__line)
      const status = completionDate ? 'completed' : 'in_progress'
      const duplicateKey = normalizeDuplicateKey(title, dueDate)

      const prepared = {
        line: record.__line,
        originalId: record['ID original'],
        duplicateKey,
        status,
        insertPayload: {
          title,
          description: title,
          due_date: dueDate,
          completion_date: completionDate ? `${completionDate}T12:00:00.000Z` : null,
          status,
          priority: 'medium',
          classification: 'operational_support',
          visible_to_client: false,
          action_origin: 'csv_action_plan_import',
          notes: buildNotes(record),
        },
      }

      if (existingKeys.has(duplicateKey) || batchKeys.has(duplicateKey)) {
        duplicateRows.push(prepared)
        continue
      }

      batchKeys.add(duplicateKey)
      validRows.push(prepared)
    } catch (error) {
      errorRows.push({
        line: record.__line,
        message: error instanceof Error ? error.message : 'Erro desconhecido.',
      })
    }
  }

  return { validRows, duplicateRows, errorRows }
}

function countByStatus(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status === 'completed' ? 'Concluída' : 'Iniciada'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
}

function getJwtRole(key) {
  const parts = key.split('.')
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function printSummary({ totalRows, validRows, duplicateRows, errorRows }) {
  const statusSummary = countByStatus(validRows)

  console.log(`Modo: ${mode === 'apply' ? 'APPLY/IMPORT' : 'DRY-RUN'}`)
  console.log(`Total de linhas lidas: ${totalRows}`)
  console.log(`Total de ações válidas: ${validRows.length + duplicateRows.length}`)
  console.log(`Total de ações que seriam importadas: ${validRows.length}`)
  console.log(`Total de ações ignoradas por duplicidade: ${duplicateRows.length}`)
  console.log(`Total de ações com erro: ${errorRows.length}`)
  console.log('Resumo por status das ações importáveis:')
  console.log(`- Iniciada: ${statusSummary.Iniciada ?? 0}`)
  console.log(`- Concluída: ${statusSummary.Concluída ?? 0}`)

  if (duplicateRows.length > 0) {
    console.log('\nDuplicidades ignoradas:')
    duplicateRows.slice(0, 20).forEach(row => {
      console.log(`- Linha ${row.line}${row.originalId ? ` / ID original ${row.originalId}` : ''}: ${row.insertPayload.title}`)
    })
    if (duplicateRows.length > 20) console.log(`- ... mais ${duplicateRows.length - 20} duplicidade(s)`)
  }

  if (errorRows.length > 0) {
    console.log('\nErros:')
    errorRows.forEach(row => console.log(`- ${row.message}`))
  }
}

async function fetchSingleByExactName(supabase, table, select, column, value, extraFilter) {
  let query = supabase.from(table).select(select).eq(column, value)
  if (extraFilter) query = extraFilter(query)

  const { data, error } = await query
  if (error) throw new Error(`Erro ao buscar ${table}: ${error.message}`)
  if (!data || data.length === 0) throw new Error(`${table}: registro não encontrado para "${value}".`)
  if (data.length > 1) throw new Error(`${table}: mais de um registro encontrado para "${value}". Abortando por segurança.`)
  return data[0]
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não encontrada no ambiente.')
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não encontrada. O importador deve rodar apenas local/server-side.')
  }

  const jwtRole = getJwtRole(supabaseKey)
  if (jwtRole && jwtRole !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY não parece ser service_role (role detectada: ${jwtRole}). ` +
      'Abortando para evitar falso negativo por RLS.'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const csvContent = readFileSync(CSV_PATH, 'utf8')
  const records = toRecords(parseCsv(csvContent))

  const client = await fetchSingleByExactName(
    supabase,
    'clients',
    'id, company_name',
    'company_name',
    CLIENT_NAME
  )

  const project = await fetchSingleByExactName(
    supabase,
    'projects',
    'id, project_name, client_id',
    'project_name',
    PROJECT_NAME,
    query => query.eq('client_id', client.id)
  )

  const responsible = await fetchSingleByExactName(
    supabase,
    'profiles',
    'id, full_name',
    'full_name',
    RESPONSIBLE_NAME
  )

  const { data: existingActions, error: existingError } = await supabase
    .from('actions')
    .select('id, title, due_date')
    .eq('project_id', project.id)

  if (existingError) throw new Error(`Erro ao buscar ações existentes: ${existingError.message}`)

  const existingKeys = new Set(
    (existingActions ?? []).map(action => normalizeDuplicateKey(action.title, action.due_date))
  )

  const { validRows, duplicateRows, errorRows } = prepareRows(records, existingKeys)

  printSummary({
    totalRows: records.length,
    validRows,
    duplicateRows,
    errorRows,
  })

  console.log('\nReferências encontradas no banco:')
  console.log(`- Cliente: ${client.company_name} (${client.id})`)
  console.log(`- Projeto: ${project.project_name} (${project.id})`)
  console.log(`- Responsável: ${responsible.full_name} (${responsible.id})`)

  if (mode !== 'apply') {
    console.log('\nNenhuma gravação realizada. Use npm run import:actions:apply para importar de verdade.')
    return
  }

  if (errorRows.length > 0) {
    throw new Error('Importação abortada: existem linhas com erro. Corrija o CSV ou revise as linhas antes de aplicar.')
  }

  if (validRows.length === 0) {
    console.log('\nNenhuma ação nova para importar.')
    return
  }

  const payload = validRows.map(row => ({
    ...row.insertPayload,
    project_id: project.id,
    assigned_to: responsible.id,
  }))

  const { data: insertedRows, error: insertError } = await supabase
    .from('actions')
    .insert(payload)
    .select('id, business_id, title, due_date, status')

  if (insertError) throw new Error(`Erro ao importar ações: ${insertError.message}`)

  console.log(`\nImportação concluída: ${insertedRows?.length ?? 0} ação(ões) criada(s).`)
}

main().catch(error => {
  console.error(`\nFalha na importação: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
