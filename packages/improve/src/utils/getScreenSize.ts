type SizeOptions = 'small' | 'medium' | 'large' | 'huge'

export const getScreenSize = (): SizeOptions => {
	const size = window.innerWidth
	if (size <= 768) return 'small'
	if (size <= 1024) return 'medium'
	if (size <= 1200) return 'large'
	return 'huge'
}
