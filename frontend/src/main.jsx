import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ScrollManager from './components/ScrollManager'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { SiteProvider } from './context/SiteContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollManager />
      <ToastProvider>
        <SiteProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </SiteProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
