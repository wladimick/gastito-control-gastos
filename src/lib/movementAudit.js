export function removeLinkedManualDuplicates(movements = [], linkedManualExpenseIds = []) {
  const linked = linkedManualExpenseIds instanceof Set
    ? linkedManualExpenseIds
    : new Set(linkedManualExpenseIds || [])

  return (movements || []).filter(item => {
    if (item?.source !== 'manual') return true
    const id = item.rawId || item.id
    return !linked.has(id)
  })
}
