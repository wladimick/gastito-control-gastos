import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import NicolCardAdmin from './components/NicolCardAdmin'
import NicolPublicCyclesVisual from './components/NicolPublicCyclesVisual'
import NicolRecurringAdmin from './components/NicolRecurringAdmin'
import MercadoPagoAdmin from './components/MercadoPagoAdmin'
import MercadoPagoCredentials from './components/MercadoPagoCredentials'
import ReceivablesAdmin from './components/ReceivablesAdmin'
import AppStatusOverlay from './components/AppStatusOverlay'
import './index.css'

const params = new URLSearchParams(window.location.search)
const nicolToken = params.get('nicol')
const nicolAdminMode = params.get('nicol-admin')
const mercadoPagoAdminMode = params.get('mercadopago-admin')
const mercadoPagoCredentialsMode = params.get('mercadopago-credentials')
const receivablesMode = params.get('me-deben')

let content = <App />
if (receivablesMode === '1') content = <ReceivablesAdmin />
else if (mercadoPagoCredentialsMode === '1') content = <MercadoPagoCredentials />
else if (mercadoPagoAdminMode === '1') content = <MercadoPagoAdmin />
else if (nicolAdminMode === 'recurrentes') content = <NicolRecurringAdmin />
else if (nicolAdminMode === '1') content = <NicolCardAdmin />
else if (nicolToken) content = <NicolPublicCyclesVisual token={nicolToken} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {content}
    <AppStatusOverlay />
  </React.StrictMode>,
)
