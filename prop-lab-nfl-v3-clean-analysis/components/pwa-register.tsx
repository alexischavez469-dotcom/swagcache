'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = () =>
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Registration is best-effort; app still works without it.
        })
      if (document.readyState === 'complete') register()
      else window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
