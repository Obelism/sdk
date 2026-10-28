export const readCookie = (header: string | null, name: string) =>
	header
		?.split('; ')
		.find((row) => row.split('=')[0] === name)
		?.split('=')[1] ?? null
