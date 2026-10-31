import {
	LEGACY_VISITOR_COOKIE,
	VISITOR_COOKIE,
	VISITOR_COOKIE_DAYS,
	VISITOR_ID_LENGTH,
	VISITOR_ID_PREFIX,
	VISITOR_ID_SEPARATOR,
	VISITOR_SESSION_KEY,
} from './constants'

export type Visitor = {
	id: string
	/** Whether the visitor had an id already: `recurring` on the server. */
	recurring: boolean
}

/**
 * Where the visitor id lives. `cookie` is the shared 30-day cookie; `session`
 * keeps it in sessionStorage for the tab only (no cookie); `none` makes a new
 * id for every page load, so visits still count but unique visitors don't.
 */
export type VisitorStorage = 'cookie' | 'session' | 'none'

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const readCookie = (name: string) => {
	const row = document.cookie
		.split('; ')
		.find((entry) => entry.split('=')[0] === name)
	return row ? (row.split('=')[1] ?? '') : ''
}

export const writeCookie = (name: string, value: string) => {
	const expires = new Date(Date.now() + VISITOR_COOKIE_DAYS * 86_400_000)
	document.cookie =
		`${name}=${value};path=/;expires=${expires.toUTCString()};SameSite=Lax` +
		(location.protocol === 'https:' ? ';Secure' : '')
}

// The improve SDK's check, so an id it (or its middleware) made stays valid.
export const isVisitorId = (value: string) => {
	const parts = value.split(VISITOR_ID_SEPARATOR)
	return (
		parts.length === 2 &&
		parts[0] === VISITOR_ID_PREFIX &&
		parts[1]!.length === VISITOR_ID_LENGTH
	)
}

export const createVisitorId = () => {
	const random = new Uint8Array(VISITOR_ID_LENGTH)
	crypto.getRandomValues(random)
	let id = ''
	for (const byte of random) id += CHARACTERS[byte % CHARACTERS.length]
	return `${VISITOR_ID_PREFIX}${VISITOR_ID_SEPARATOR}${id}`
}

const readStoredVisitor = (storage: 'cookie' | 'session') => {
	if (storage === 'session') {
		try {
			return sessionStorage.getItem(VISITOR_SESSION_KEY) ?? ''
		} catch {
			return ''
		}
	}
	return readCookie(VISITOR_COOKIE) || readCookie(LEGACY_VISITOR_COOKIE)
}

const writeStoredVisitor = (storage: 'cookie' | 'session', id: string) => {
	if (storage === 'session') {
		try {
			sessionStorage.setItem(VISITOR_SESSION_KEY, id)
		} catch {
			// Storage can be disabled; the id then lives for this call only.
		}
		return
	}
	writeCookie(VISITOR_COOKIE, id)
	// Keep the old cookie in step while sites still run an improve SDK that
	// reads it, so the same visitor isn't split in two.
	if (readCookie(LEGACY_VISITOR_COOKIE)) writeCookie(LEGACY_VISITOR_COOKIE, id)
}

// The visitor in its storage, or a new one; either way it is written again, so
// the cookie lasts 30 days from the last visit and the session id lasts the tab.
export const loadVisitor = (storage: VisitorStorage = 'cookie'): Visitor => {
	if (storage === 'none') return { id: createVisitorId(), recurring: false }

	const existing = readStoredVisitor(storage)
	const recurring = isVisitorId(existing)
	const id = recurring ? existing : createVisitorId()
	writeStoredVisitor(storage, id)
	return { id, recurring }
}
