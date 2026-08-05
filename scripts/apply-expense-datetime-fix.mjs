import fs from 'node:fs'

const componentPath = 'src/components/ExpenseModal.jsx'
const workflowPath = '.github/workflows/apply-expense-datetime-fix.yml'
const scriptPath = 'scripts/apply-expense-datetime-fix.mjs'
const docsPath = 'docs/2026-08-05-correccion-fecha-hora-gastos.md'

let source = fs.readFileSync(componentPath, 'utf8')

const helperAnchor = "import { useBanks } from '../services/banksService'\n"
const helpers = `

// El input datetime-local no trabaja con zonas horarias. Estas funciones
// convierten entre el ISO guardado en Supabase y la hora local del dispositivo
// sin mostrar UTC como si fuera hora local.
function toLocalDateTimeParts(value) {
  const parsed = value ? new Date(value) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  const local = shifted.toISOString()
  return {
    date: local.slice(0, 10),
    time: local.slice(11, 16),
  }
}

function localDateTimeToIso(datePart, timePart) {
  if (!datePart) return new Date().toISOString()
  const safeTime = /^\\d{2}:\\d{2}$/.test(timePart || '') ? timePart : '00:00'
  const parsed = new Date(\`${datePart}T${safeTime}:00\`)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}
`

if (!source.includes('function toLocalDateTimeParts')) {
  if (!source.includes(helperAnchor)) throw new Error('No se encontró el punto de inserción de helpers')
  source = source.replace(helperAnchor, helperAnchor + helpers)
}

const oldDateLine = "  const dateInput = new Date(form.date).toISOString().slice(0, 16)"
const newDateLine = "  const localDateTime = toLocalDateTimeParts(form.date)"
if (!source.includes(oldDateLine)) throw new Error('No se encontró la conversión UTC antigua')
source = source.replace(oldDateLine, newDateLine)

const blockRegex = /\s*\{\/\* Categoría \+ fecha \*\/\}[\s\S]*?\n\s*\{\/\* Medio \+ banco \*\/\}/
const replacement = `

          {/* Categoría */}
          <div>
            <FieldLabel>Categoría</FieldLabel>
            <StyledSelect value={form.category} onChange={v => setF('category', v)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </StyledSelect>
          </div>

          {/* Fecha y hora local */}
          <div className="rounded-[12px] border p-3" style={{ background: '#faf9f6', borderColor: '#e8e6df' }}>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <FieldLabel>Fecha y hora</FieldLabel>
                <div className="text-[11px] -mt-1" style={{ color: '#9ba5c2' }}>
                  Hora local de este dispositivo
                </div>
              </div>
              <button
                type="button"
                onClick={() => setF('date', new Date().toISOString())}
                className="shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold"
                style={{ background: '#ffffff', borderColor: '#dddbd3', color: '#5d6888' }}>
                Usar ahora
              </button>
            </div>
            <div className="grid grid-cols-[1.25fr_.75fr] gap-2.5">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold mb-1" style={{ color: '#9ba5c2' }}>Fecha</div>
                <TxtInput
                  type="date"
                  value={localDateTime.date}
                  onChange={e => setF('date', localDateTimeToIso(e.target.value, localDateTime.time))}
                  style={{ minWidth: 0 }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold mb-1" style={{ color: '#9ba5c2' }}>Hora</div>
                <TxtInput
                  type="time"
                  value={localDateTime.time}
                  onChange={e => setF('date', localDateTimeToIso(localDateTime.date, e.target.value))}
                  style={{ minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Medio + banco */}`

if (!blockRegex.test(source)) throw new Error('No se encontró el bloque de categoría y fecha')
source = source.replace(blockRegex, replacement)
fs.writeFileSync(componentPath, source)

fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync(docsPath, `# Corrección de fecha y hora al crear gastos

- **Fecha:** 2026-08-05
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Problema

El formulario usaba \`toISOString().slice(0, 16)\` para alimentar un campo \`datetime-local\`. Ese valor está en UTC, pero el navegador lo interpretaba como hora local, desplazando la hora de Chile y pudiendo cambiar el día.

## Corrección

- El ISO guardado en Supabase se convierte primero a la hora local del dispositivo.
- Al guardar, la fecha y hora locales se convierten nuevamente a ISO con zona horaria.
- La selección se separó en campos de fecha y hora para evitar el selector combinado confuso del navegador.
- Se agregó el botón **Usar ahora**.
- Supabase mantiene \`expense_date\` como \`timestamptz\`; no se modifica el esquema ni los movimientos existentes.

## Validación esperada

- Al abrir un gasto nuevo, debe aparecer el día y la hora actuales del dispositivo.
- Editar un gasto existente no debe adelantar ni atrasar su hora.
- Guardar y volver a abrir debe conservar exactamente la fecha y hora seleccionadas.
`)

fs.rmSync(workflowPath, { force: true })
fs.rmSync(scriptPath, { force: true })
