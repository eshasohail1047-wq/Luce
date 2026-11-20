import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './AppRouter'
import './index.css'
import './App.css'
import './dark-theme.css'
import './mobile.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
