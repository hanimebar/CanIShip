import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import CookieBanner from '@/components/CookieBanner'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'CanIShip — AI-Powered App QA for Solo Builders',
  description:
    'Bulletproof QA in minutes. Functional tests, accessibility, performance, security — all in one audit. Get your ShipScore and ship with confidence.',
  keywords: ['QA', 'quality assurance', 'app testing', 'accessibility', 'performance', 'solo builders'],
  metadataBase: new URL('https://caniship.actvli.com'),
  alternates: {
    canonical: 'https://caniship.actvli.com',
  },
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
    other: [
      { rel: 'icon', url: '/icon-64.png', sizes: '64x64' },
    ],
  },
  openGraph: {
    title: 'CanIShip — Can Your App Ship?',
    description: 'AI-powered app audit. One URL. One score. Ship or fix.',
    type: 'website',
    url: 'https://caniship.actvli.com',
    images: [
      {
        url: 'https://caniship.actvli.com/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'CanIShip — AI-Powered App QA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CanIShip — AI QA for Solo Builders',
    description: 'Get your ShipScore in minutes. Know exactly what to fix before launch.',
    images: ['https://caniship.actvli.com/og-image.svg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-900 text-white antialiased min-h-screen">
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <main id="main-content">
          {children}
        </main>
        <CookieBanner />
        {/* Plausible Analytics — privacy-first, no cookies, GDPR compliant */}
        <Script
          src="https://plausible.io/js/pa-CvZG1CbL6aEjx6rqGsKN1.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">{`
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};
          window.plausible.init=window.plausible.init||function(i){window.plausible.o=i||{}};
          window.plausible.init();
        `}</Script>
      </body>
    </html>
  )
}
