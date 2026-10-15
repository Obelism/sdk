import { ContentBridge } from '@obelism/content-react'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				{/* Lets the visual editor select blocks on every page. */}
				<ContentBridge url={process.env.NEXT_PUBLIC_CONTENT_URL} />
				{children}
			</body>
		</html>
	)
}
