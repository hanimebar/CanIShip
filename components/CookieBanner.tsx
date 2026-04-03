'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'caniship-cookie-consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-gray-300 leading-relaxed">
          <span className="font-semibold text-white">Cookies</span>{' '}
          We use only strictly necessary cookies — to keep you logged in and process payments securely. No tracking, no advertising, no data sold.{' '}
          <Link href="/cookie-policy" className="text-neon-green hover:underline whitespace-nowrap">
            Cookie Policy
          </Link>
        </div>
        <button
          onClick={accept}
          className="flex-shrink-0 px-5 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-xl hover:bg-neon-green-dim transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
