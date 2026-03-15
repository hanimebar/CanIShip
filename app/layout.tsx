import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CanIShip — AI-Powered App QA for Solo Builders',
  description:
    'Bulletproof QA in minutes. Functional tests, accessibility, performance, security — all in one audit. Get your ShipScore and ship with confidence.',
  keywords: ['QA', 'quality assurance', 'app testing', 'accessibility', 'performance', 'solo builders'],
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/apple-touch-icon.svg',
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
        {children}
      </body>
    </html>
  )
}
