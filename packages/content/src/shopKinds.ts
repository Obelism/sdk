// What a site's shop pages come in. Both the bridge's SHOP table and the
// site's API routes are built from this list.
export type ShopKind = 'product' | 'collection'

export const SHOP_KINDS = ['product', 'collection'] as const
