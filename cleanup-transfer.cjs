async function main() {
  const baseUrl = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!baseUrl || !key) throw new Error('Supabase credentials are unavailable')

  const objects = [
    'gastito-billing-final.tar.gz',
    'gastito-billing-final.tar.gz.b64',
  ]

  for (const objectName of objects) {
    const response = await fetch(`${baseUrl}/storage/v1/object/chatgpt-transfer/${objectName}`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })
    if (![200, 204, 404].includes(response.status)) {
      throw new Error(`Delete failed for ${objectName}: ${response.status} ${await response.text()}`)
    }
    console.log(`TRANSFER_DELETE ${objectName} status=${response.status}`)
  }

  console.log('TRANSFER_DELETE_OK')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
