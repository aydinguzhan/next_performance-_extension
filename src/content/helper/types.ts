export type NextAppKind = "app-router" | "pages-router" | "unknown";

export type NextAppDetectionResult = {
  isNextApp: boolean;
  nextAppKind: NextAppKind;
  hasNextDataScript: boolean;
  hasNextHeadMeta: boolean;
  hasNextAssets: boolean;
  hasAppRouterFlightData: boolean;
  hasNextRoot: boolean;
};

export type AnalysisMetrics = {
  ttfb: number | null;
  domContentLoaded: number | null;
  loadEvent: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  routeRenderTime: number | null;
};

export type AnalysisSignals = {
  nextDataSize: number | null;
  scriptCount: number;
  domNodeCount: number;
  imageMissingDimensionsCount: number;
};

export type MetricStatus = "good" | "warning" | "critical" | "unknown";

export type MetricStatuses = {
  lcp: MetricStatus;
  cls: MetricStatus;
  ttfb: MetricStatus;
  render: MetricStatus;
};

export type AnalysisScore = {
  overall: number;
  label: MetricStatus;
  statuses: MetricStatuses;
};

export type PageAnalysis = {
  url: string;
  title: string;
  capturedAt: string;
  isEnabled: boolean;
  next: NextAppDetectionResult;
  metrics: AnalysisMetrics;
  signals: AnalysisSignals;
  score: AnalysisScore;
  recommendations: string[];
};

export type AnalysisHistory = PageAnalysis[];
