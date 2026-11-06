// What a site's shop pages come in: the bridge's SHOP table is keyed by the
// type, and the site's API routes are built from the list.
export type ShopKind = 'product' | 'collection'

export const SHOP_KINDS = ['product', 'collection'] as const
