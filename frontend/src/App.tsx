import { useEffect, useState } from 'react'
import Login from './Pages/Login'
import MailDashboard from './Pages/MailDashboard'
import Hero from './Pages/Hero'
import Terms from './Pages/Terms'

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [showHero, setShowHero] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  // Initialize to empty so refresh renders Hero by default
  const [route, setRoute] = useState<string>('')

  // Check if user is already logged in on page load
  useEffect(() => {
    let cancelled = false
    
    async function checkAuthentication() {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
        })
        
        if (!response.ok) {
          if (!cancelled) {
            setLoggedIn(false)
            setCheckingAuth(false)
          }
          return
        }
        
        const data = await response.json()
        
        if (!cancelled && data.authenticated && data.profile) {
          setLoggedIn(true)
          setShowHero(false)
          setCheckingAuth(false)
        } else {
          if (!cancelled) {
            setLoggedIn(false)
            setCheckingAuth(false)
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        if (!cancelled) {
          setLoggedIn(false)
          setCheckingAuth(false)
        }
      }
    }
    
    checkAuthentication()
    
    return () => {
      cancelled = true
    }
  }, [])

  // Hide privacy banner when user is logged in
  useEffect(() => {
    if (loggedIn) {
      document.body.classList.add('hide-privacy-banner')
    } else {
      document.body.classList.remove('hide-privacy-banner')
    }
  }, [loggedIn])

  // Minimal hash-based routing for marketing pages (reactive)
  useEffect(() => {
    const handle = () => setRoute(window.location.hash.replace(/^#/, ''))
    window.addEventListener('hashchange', handle)
    // In case something changed the hash before mount
    handle()
    return () => window.removeEventListener('hashchange', handle)
  }, [])

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid rgba(255,255,255,0.1)', 
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ fontSize: 14, opacity: 0.7 }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (route === 'terms' || route === 'privacy' || route === 'privacy-policy') return <Terms />
  if (showHero && !loggedIn) return <Hero onLoggedIn={() => { setLoggedIn(true); setShowHero(false) }} />
  // Example route to preview the marketing page similar to the screenshot
  // return <Speed />
  if (!loggedIn) return <Login onLoggedIn={() => setLoggedIn(true)} />
  return <MailDashboard />
}

export default App
