import { useFetcher } from 'react-router'

type Result = { sent: boolean; status?: number; order?: { id: string } }

// One server-side numbers event, with the visitor's cookie and the
// environment's token. A Worker's subrequest carries no buyer IP, so all these
// events share one 300-a-minute bucket, and none carries a country.
export function PurchaseTest() {
	const fetcher = useFetcher<Result>()
	const busy = fetcher.state !== 'idle'

	return (
		<section
			className="max-w-page px-margin mx-auto w-full py-12"
			aria-labelledby="purchase-test"
		>
			<h2 id="purchase-test" className="type-heading-xl mb-2">
				A server event
			</h2>
			<p className="text-on-surface-secondary mb-4 max-w-prose text-sm">
				Sends a test order's <code>purchase</code> to numbers from an action,
				with the visitor id from the cookie and no country: Oxygen has no{' '}
				<code>cf-connecting-ip</code> on a subrequest.
			</p>
			<fetcher.Form method="post" action="/api/purchase">
				<button
					className="rounded-button button-primary focus-visible:outline-accent inline-flex h-11 items-center px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
					disabled={busy}
					data-testid="send-purchase"
				>
					{busy ? 'Sending…' : 'Send a test purchase'}
				</button>
			</fetcher.Form>
			{fetcher.data ? (
				<p className="mt-3 text-sm" role="status" data-purchase-result>
					{fetcher.data.sent
						? `Sent ${fetcher.data.order?.id ?? 'the order'}`
						: `Not sent (${fetcher.data.status ?? 'not configured'})`}
				</p>
			) : null}
		</section>
	)
}
