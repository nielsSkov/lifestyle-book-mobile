import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [message, setMessage] = useState('')
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt)
  }, [])

  if (!prompt && message)
    return (
      <span className="install-message-inline" role="status">
        {message}
      </span>
    )
  if (!prompt && !isIos) return <span className="prototype-label">Prototype 01</span>

  return (
    <div className="install-control">
      {!isStandalone ? (
        <button
          className="install-button"
          type="button"
          onClick={() => {
            if (!prompt) {
              setMessage('In Safari, tap Share, then Add to Home Screen.')
              return
            }
            void prompt
              .prompt()
              .then(() => prompt.userChoice)
              .then(({ outcome }) => {
                setMessage(
                  outcome === 'accepted' ? 'Installation started.' : 'Installation cancelled.',
                )
                if (outcome === 'accepted') setPrompt(null)
              })
              .catch(() => setMessage('Installation could not start. Please try again.'))
          }}
        >
          {isIos && !prompt ? 'How to install' : 'Install app'}
        </button>
      ) : (
        <span className="prototype-label">Installed</span>
      )}
      {message ? (
        <span className="install-message" role="status">
          {message}
        </span>
      ) : null}
    </div>
  )
}
