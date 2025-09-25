import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Match Cut Generator",
  description: "Create cinematic text match cut clips instantly",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center min-h-screen">
        {children}
      </body>
    </html>
  )
}
