import type {
  DashboardTrafficDimensionKey,
  DashboardTrafficRange,
} from "~~/types/dashboard";

export type { DashboardTrafficDimensionKey } from "~~/types/dashboard";

export interface DashboardTrafficDimensionOption {
  key: DashboardTrafficDimensionKey;
  label: string;
}

export const DASHBOARD_TRAFFIC_DIMENSION_GROUPS = {
  acquisition: [
    "source",
    "referrerDomain",
    "referrerTerms",
    "trafficType",
    "platform",
    "channel",
    "medium",
    "aiReferral",
  ],
  audience: ["country", "region", "city"],
  technology: [
    "deviceType",
    "browser",
    "browserVersion",
    "operatingSystem",
    "operatingSystemVersion",
    "apiClient",
  ],
  content: ["landingPagePath", "landingPageType", "campaign", "campaignContent"],
} as const satisfies Record<string, readonly DashboardTrafficDimensionKey[]>;

export const DASHBOARD_TRAFFIC_DIMENSION_LABEL_KEYS = {
  source: "dashboard.trafficDetailSource",
  referrerDomain: "dashboard.trafficDetailReferrerDomain",
  referrerTerms: "dashboard.trafficDetailReferrerTerms",
  trafficType: "dashboard.trafficDetailTrafficType",
  platform: "dashboard.trafficDetailPlatform",
  channel: "dashboard.trafficDetailChannel",
  medium: "dashboard.trafficDetailMedium",
  aiReferral: "dashboard.trafficDetailAiReferral",
  country: "dashboard.trafficDetailCountry",
  region: "dashboard.trafficDetailRegion",
  city: "dashboard.trafficDetailCity",
  deviceType: "dashboard.trafficDetailDevice",
  browser: "dashboard.trafficDetailBrowser",
  browserVersion: "dashboard.trafficDetailBrowserVersion",
  operatingSystem: "dashboard.trafficDetailOs",
  operatingSystemVersion: "dashboard.trafficDetailOsVersion",
  apiClient: "dashboard.trafficDetailApiClient",
  landingPagePath: "dashboard.trafficDetailLandingPath",
  landingPageType: "dashboard.trafficDetailLandingType",
  campaign: "dashboard.trafficDetailCampaign",
  campaignContent: "dashboard.trafficDetailCampaignContent",
} as const satisfies Record<DashboardTrafficDimensionKey, string>;

export function trafficDimensionRequestKey(
  range: DashboardTrafficRange,
  dimension: DashboardTrafficDimensionKey,
) {
  return `${range}:${dimension}`;
}
