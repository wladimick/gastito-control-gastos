const DATA_HEALTH_EVENT = 'gastito:data-health'
const MUTATION_EVENT = 'gastito:mutation-error'

const dataHealthState = new Map()

function emit(name, detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

export function reportDataHealth(source, status, message = '') {
  const detail = {
    source,
    status,
    message,
    at: new Date().toISOString(),
  }
  dataHealthState.set(source, detail)
  emit(DATA_HEALTH_EVENT, detail)
  return detail
}

export function getDataHealthSnapshot() {
  return [...dataHealthState.values()]
}

export function reportMutationError(context, error) {
  const detail = {
    context,
    message: error?.message || String(error || 'Error desconocido'),
    at: new Date().toISOString(),
  }
  emit(MUTATION_EVENT, detail)
  return detail
}

export function observeAppEvents({ onDataHealth, onMutationError }) {
  if (typeof window === 'undefined') return () => {}
  const healthHandler = event => onDataHealth?.(event.detail)
  const mutationHandler = event => onMutationError?.(event.detail)
  window.addEventListener(DATA_HEALTH_EVENT, healthHandler)
  window.addEventListener(MUTATION_EVENT, mutationHandler)
  return () => {
    window.removeEventListener(DATA_HEALTH_EVENT, healthHandler)
    window.removeEventListener(MUTATION_EVENT, mutationHandler)
  }
}
