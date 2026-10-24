// A token, or a function that gives one per request: a host OIDC token from
// ./oidc, or anything else that rotates.
export type TokenSource = string | (() => string | Promise<string>)

export const resolveToken = (token: TokenSource) =>
	typeof token === 'function' ? token() : token
