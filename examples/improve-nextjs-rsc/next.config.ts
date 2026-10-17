import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	// Cache Components (formerly `dynamicIO`) makes the route static by default
	// and forces every dynamic read (cookies, headers, ...) to live inside a
	// <Suspense> boundary. That is exactly what we want here: the marketing
	// shell is prerendered/cached while the per-visitor experiment streams in.
	cacheComponents: true,
}

export default nextConfig
