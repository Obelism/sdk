import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
	index('routes/home.tsx'),
	route('pages/*', 'routes/page.tsx'),
	route('p/:id', 'routes/product-by-id.tsx'),
	route('cms/*', 'routes/cms.tsx'),
	route('api/purchase', 'routes/api.purchase.tsx'),
	route('products/:handle', 'routes/product.tsx'),
	route('collections', 'routes/collections.tsx'),
	route('collections/:handle', 'routes/collection.tsx'),
	route('cart', 'routes/cart.tsx'),
	route('search', 'routes/search.tsx'),
	route('account', 'routes/account.tsx'),
	route('*', 'routes/catchall.tsx'),
] satisfies RouteConfig
