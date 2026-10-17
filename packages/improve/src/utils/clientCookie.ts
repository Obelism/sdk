const ROW_DELIMITER = '; '
const ENTRY_DELIMITER = '='

export const getCookie = (name: string) => {
	if (!name) return false
	const cookie = document.cookie.split(ROW_DELIMITER).find((row) => {
		const [key] = row.split(ENTRY_DELIMITER)
		return name === key
	})
	return cookie ? cookie.split(ENTRY_DELIMITER)[1] : false
}

export const setCookie = (name: string, value: string) => {
	const now = new Date()
	now.setDate(now.getDate() + 30)
	document.cookie = `${name}=${value};path=/;expires=${now.toUTCString()};SameSite=Lax;Secure`
}
