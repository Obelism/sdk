// The cookies in a `Cookie` header or `document.cookie`, by name: the first
// of each name, percent-decoded when it decodes.
export const parseCookies = (header: string) => {
	const cookies = new Map<string, string>()
	for (const part of header.split(';')) {
		const index = part.indexOf('=')
		if (index < 0) continue
		const name = part.slice(0, index).trim()
		if (!name || cookies.has(name)) continue
		try {
			cookies.set(name, decodeURIComponent(part.slice(index + 1).trim()))
		} catch {
			cookies.set(name, part.slice(index + 1).trim())
		}
	}
	return cookies
}
