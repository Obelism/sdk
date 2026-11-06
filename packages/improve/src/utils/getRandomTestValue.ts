// The slug and split are all a pick needs: tests' and flags' options alike.
export const getRandomTestValue = (
	options: readonly { slug: string; split: number }[],
) => {
	const [first] = options
	if (!first) return null
	if (options.length === 1) return first.slug

	// Get a random number between 0 and 1
	const sum = options.reduce((acc, { split }) => acc + split, 0)
	let value = Math.random() * sum

	const match =
		options.find(({ split }) => {
			value -= split
			return value <= 0
		}) || first

	return match.slug
}
