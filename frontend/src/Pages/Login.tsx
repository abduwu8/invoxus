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
              alert('Failed to sign in with Gmail access')
            }
          },
        })

        // Attach to a global so our button can trigger it
        ;(window as any)._requestGmailCode = () => codeClient.requestCode()
      }
    }

    initialize()
  }, [])

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
          }}
        >
          Continue with Google to view Gmail
        </button>
      </div>
    </div>
  )
}


