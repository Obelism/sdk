export const DEFAULT_URL = 'https://content.obelism.studio'

export const DELIVERY_PATH = '/api/delivery/v1'
export const MANAGEMENT_PATH = '/api/management/v1'

export const DEFAULT_TIMEOUT = 10_000

// Origin only, without a trailing slash: what API paths are appended to and
// what the bridge checks messages against.
export const normalizeUrl = (url: string) => new URL(url).origin
