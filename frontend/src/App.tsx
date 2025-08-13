import { useEffect, useState } from 'react'
import Login from './Pages/Login'
import MailDashboard from './Pages/MailDashboard'
import Hero from './Pages/Hero'
import Terms from './Pages/Terms'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [showHero, setShowHero] = useState(true)
  // Initialize to empty so refresh renders Hero by default
  const [route, setRoute] = useState<string>('')

  // Minimal hash-based routing for marketing pages (reactive)
  useEffect(() => {
    const handle = () => setRoute(window.location.hash.replace(/^#/, ''))
    window.addEventListener('hashchange', handle)
    // In case something changed the hash before mount
    handle()
    return () => window.removeEventListener('hashchange', handle)
  }, [])

  if (route === 'terms' || route === 'privacy' || route === 'privacy-policy') return <Terms />
  if (showHero) return <Hero onLoggedIn={() => { setLoggedIn(true); setShowHero(false) }} />
  // Example route to preview the marketing page similar to the screenshot
  // return <Speed />
  if (!loggedIn) return <Login onLoggedIn={() => setLoggedIn(true)} />
  return <MailDashboard />
}

export default App
