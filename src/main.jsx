import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import NicolShare from './components/NicolShare'
import NicolPublicCycles from './components/NicolPublicCycles'
import NicolRecurringAdmin from './components/NicolRecurringAdmin'
import './index.css'

const params = new URLSearchParams(window.location.search)
const nicolToken = params.get('nicol')
const nicolAdminMode = params.get('nicol-admin')

let content = <App />
if (nicolAdminMode === 'recurrentes') content = <NicolRecurringAdmin />
else if (nicolAdminMode === '1') content = <NicolShare mode="admin" />
else if (nicolToken) content = <NicolPublicCycles token={nicolToken} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
)
