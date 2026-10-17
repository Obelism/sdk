import { ImproveAudienceValue } from '../types'
import { AudienceParamKey } from '../config/audiences'
import { ParsedUserAgent } from './parseUserAgent'

export const getVisitorMatchesAudience = (
	audience: ImproveAudienceValue | undefined,
	visitorParams: ParsedUserAgent,
) => {
	if (!audience) return true
	return Object.entries(audience).every(([paramKey, paramValue]) => {
		return visitorParams[paramKey as AudienceParamKey] === paramValue
	})
}
