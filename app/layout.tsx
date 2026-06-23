import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finsmart MMS',
  description: 'Finsmart Management & Marketing Suite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
