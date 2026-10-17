import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'
import { ImproveProvider } from './improve'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Improve SDK — Next.js RSC + Cache Components',
	description:
		'A/B testing with the Obelism Improve SDK using React Server Components and Next.js Cache Components',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<ImproveProvider>{children}</ImproveProvider>
			</body>
		</html>
	)
}
