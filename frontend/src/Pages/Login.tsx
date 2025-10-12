import { useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

declare global {
  interface Window {
    google?: any
  }
}

type GoogleCredentialResponse = {
  credential?: string
}

export default function Login({ onLoggedIn }: { onLoggedIn?: () => void }) {
  const buttonDivRef = useRef<HTMLDivElement | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [isLoadingMicrosoft, setIsLoadingMicrosoft] = useState(false)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) {
      const msg = 'Missing VITE_GOOGLE_CLIENT_ID in frontend/.env'
      console.error(msg)
      setConfigError(msg)
      return
    }

    const looksLikeWebClient = /\.apps\.googleusercontent\.com$/.test(clientId)
    if (!looksLikeWebClient) {
      const msg = 'VITE_GOOGLE_CLIENT_ID does not look like a Web Client ID (*.apps.googleusercontent.com)'
      console.error(msg, clientId)
      setConfigError(msg)
      return
    }

    // Wait until the Google script is loaded
    function initialize() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        // try again shortly if script not ready
        setTimeout(initialize, 50)
        return
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => {
          // For now, just log the JWT. Later we'll send it to backend and exchange for session.
          console.log('Google credential:', response.credential)
        },
        auto_select: false,
        ux_mode: 'popup',
      })

      if (buttonDivRef.current) {
        window.google.accounts.id.renderButton(buttonDivRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280,
        })
      }

      // Set up OAuth 2.0 Code flow for Gmail access
      if (window.google?.accounts?.oauth2) {
        const codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope:
            'openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
          ux_mode: 'popup',
          prompt: 'consent',
          callback: async (resp: any) => {
            if (resp.error) {
              console.error('Code client error', resp)
              return
            }
            try {
              const r = await fetch(`${API_BASE}/api/auth/google`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: resp.code }),
              })
              if (!r.ok) throw new Error('Auth with backend failed')
              onLoggedIn?.()
            } catch (e) {
              console.error(e)
              import('sonner').then(({ toast }) => toast.error('Failed to sign in with Gmail access'))
            }
          },
        })

        // Attach to a global so our button can trigger it
        ;(window as any)._requestGmailCode = () => codeClient.requestCode()
      }
    }

    initialize()
  }, [])

  // Handle Microsoft/Outlook login
  const handleMicrosoftLogin = async () => {
    try {
      setIsLoadingMicrosoft(true)
      
      // Get authorization URL from backend
      const response = await fetch(`${API_BASE}/api/auth/microsoft/login`, {
        method: 'GET',
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to initiate Microsoft login')
      }
      
      const { authUrl } = await response.json()
      
      // Open popup for Microsoft login
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        authUrl,
        'Microsoft Login',
        `width=${width},height=${height},left=${left},top=${top}`
      )
      
      // Listen for the OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'microsoft-oauth-success') {
          const { code } = event.data
          
          // Exchange code for tokens via backend
          const authResponse = await fetch(`${API_BASE}/api/auth/microsoft/callback`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          })
          
          if (!authResponse.ok) {
            throw new Error('Failed to authenticate with Microsoft')
          }
          
          window.removeEventListener('message', handleMessage)
          popup?.close()
          onLoggedIn?.()
        }
      }
      
      window.addEventListener('message', handleMessage)
      
      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setIsLoadingMicrosoft(false)
        }
      }, 500)
      
    } catch (error) {
      console.error('Microsoft login error:', error)
      import('sonner').then(({ toast }) => toast.error('Failed to sign in with Microsoft'))
      setIsLoadingMicrosoft(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Login</h1>
        {configError ? (
          <div style={{ color: 'crimson', maxWidth: 420, textAlign: 'center' }}>
            {configError}
          </div>
        ) : null}
        <div ref={buttonDivRef} />
        <button
          onClick={() => (window as any)._requestGmailCode?.()}
          style={{
            marginTop: 8,
            background: '#1a73e8',
            color: 'white',
            border: 0,
            borderRadius: 6,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Continue with Google to view Gmail
        </button>

        <div style={{ margin: '8px 0', color: '#666', fontSize: 14 }}>or</div>

        <button
          onClick={handleMicrosoftLogin}
          disabled={isLoadingMicrosoft}
          style={{
            background: '#0078d4',
            color: 'white',
            border: 0,
            borderRadius: 6,
            padding: '10px 14px',
            cursor: isLoadingMicrosoft ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            opacity: isLoadingMicrosoft ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isLoadingMicrosoft ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Connecting...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
              </svg>
              Continue with Microsoft/Outlook
            </>
          )}
        </button>
      </div>
    </div>
  )
}


