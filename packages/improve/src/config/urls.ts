export const BASE_URL = 'https://improve.obelism.studio'
export const CONFIG_PATH = `/config`
// Datafile format 2, with exclusion groups and holdouts (Improve's
// docs/adr/0014). Without it, their tests are served with allocation 0.
export const CONFIG_QUERY = '?groups=1'
// Events go to Obelism Numbers (the Numbers SDK's default endpoint); only a
// custom `baseUrl` sends them to its own /api/log.
export const ANALYTICS_PATH = `/api/log`
