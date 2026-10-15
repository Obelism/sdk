import type { NextConfig } from 'next'

const contentUrl =
	process.env.NEXT_PUBLIC_CONTENT_URL ?? 'https://content.obelism.studio'

const nextConfig: NextConfig = {
	// The visual editor shows the site in an iframe: allow the CMS to frame it.
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: `frame-ancestors 'self' ${new URL(contentUrl).origin}`,
					},
				],
			},
		]
	},
	images: {
		remotePatterns: [new URL(`${new URL(contentUrl).origin}/files/**`)],
	},
}

export default nextConfig
