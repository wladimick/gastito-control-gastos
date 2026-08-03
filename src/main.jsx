import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import NicolShare from './components/NicolShare'
import './index.css'

const params = new URLSearchParams(window.location.search)
const nicolToken = params.get('nicol')
const isNicolAdmin = params.get('nicol-admin') === '1'

let content = <App />
if (isNicolAdmin) content = <NicolShare mode="admin" />
else if (nicolToken) content = <NicolShare mode="public" token={nicolToken} />

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
)
