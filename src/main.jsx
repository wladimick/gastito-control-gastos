import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import NicolCardAdmin from './components/NicolCardAdmin'
import NicolPublicCyclesVisual from './components/NicolPublicCyclesVisual'
import NicolRecurringAdmin from './components/NicolRecurringAdmin'
import './index.css'

const params = new URLSearchParams(window.location.search)
const nicolToken = params.get('nicol')
const nicolAdminMode = params.get('nicol-admin')

let content = <App />
if (nicolAdminMode === 'recurrentes') content = <NicolRecurringAdmin />
else if (nicolAdminMode === '1') content = <NicolCardAdmin />
else if (nicolToken) content = <NicolPublicCyclesVisual token={nicolToken} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
)
