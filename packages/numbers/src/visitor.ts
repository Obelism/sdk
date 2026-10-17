import {
	VISITOR_COOKIE,
	VISITOR_COOKIE_DAYS,
	VISITOR_ID_LENGTH,
	VISITOR_ID_PREFIX,
	VISITOR_ID_SEPARATOR,
} from './constants'

export type Visitor = {
	id: string
	/** Whether the visitor had a cookie already: `recurring` on the server. */
	recurring: boolean
}

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

// The visitor in the cookie, or a new one; either way the cookie is set
// again, so it lasts 30 days from the last visit.
export const loadVisitor = (): Visitor => {
	const existing = readCookie(VISITOR_COOKIE)
	const recurring = isVisitorId(existing)
	const id = recurring ? existing : createVisitorId()
	writeCookie(VISITOR_COOKIE, id)
	return { id, recurring }
}
