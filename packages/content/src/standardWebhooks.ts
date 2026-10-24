// Standard Webhooks (https://www.standardwebhooks.com/), the scheme the CMS
// signs both webhooks and prompt requests with: HMAC-SHA256 over
// `{id}.{timestamp}.{body}`, keyed with the base64 part of the `whsec_…`
// secret, in `webhook-signature` as `v1,<base64>` (several, space-separated,
// while a secret is rotated).

export const SECRET_PREFIX = 'whsec_'
// Seconds a request's timestamp may be off, against replays.
export const DEFAULT_TOLERANCE = 5 * 60
// Each signature costs an HMAC over the whole body, and the header is the
// sender's: a rotation needs two, so anything near this many is not the CMS.
const MAX_SIGNATURES = 5
const SIGNATURE_BYTES = 32

export type SignedMessage = {
	body: string
	id: string | null
	timestamp: string | null
	signatures: string | null
}

const base64ToBytes = (value: string) =>
	Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

// Checks a message's signature and timestamp; calls `fail` (which throws the
// caller's own error) when it isn't from the CMS.
export const verifySignature = async (
	{ body, id, timestamp, signatures }: SignedMessage,
	secret: string,
	{
		tolerance = DEFAULT_TOLERANCE,
		now = Date.now(),
		fail,
	}: { tolerance?: number; now?: number; fail: (message: string) => never },
) => {
	if (!id || !timestamp || !signatures) fail('Missing signature headers')
	const seconds = Number(timestamp)
	// Written so a NaN tolerance rejects rather than skips the check.
	if (!(Math.abs(now / 1000 - seconds) <= tolerance)) {
		fail('Timestamp outside the tolerance')
	}
	const candidates = signatures!.split(' ')
	if (candidates.length > MAX_SIGNATURES) fail('Too many signatures')

	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(secret.slice(SECRET_PREFIX.length)),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	)
	const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`)
	let valid = false
	for (const signature of candidates) {
		const [version, value] = signature.split(',')
		if (version !== 'v1' || !value) continue
		let bytes: Uint8Array<ArrayBuffer>
		try {
			bytes = base64ToBytes(value)
		} catch {
			continue
		}
		if (bytes.length !== SIGNATURE_BYTES) continue
		// crypto.subtle.verify compares in constant time.
		if (await crypto.subtle.verify('HMAC', key, bytes, signed)) valid = true
	}
	if (!valid) fail('Invalid signature')
}
