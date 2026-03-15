import { Helper } from "./helper/helper";
import type {
  AnalysisHistory,
  AnalysisScore,
  AnalysisMetrics,
  AnalysisSignals,
  MetricStatus,
  PageAnalysis,
} from "./helper/types";

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput: boolean;
  value: number;
};

const helper = new Helper(document);
const initialPath = getCurrentRouteKey();
let activePath = initialPath;
let routeMeasureStartedAt = performance.now();
let isEnabled = true;
let hasPendingLoadRetry = false;
let latestLcp: number | null = null;
let latestCls = 0;
const HISTORY_LIMIT = 25;

injectBadgeStyles();
observePerformanceMetrics();

void syncEnabledState();
observeRouteChanges();
observeEnabledChanges();

async function syncEnabledState(): Promise<void> {
  isEnabled = await getEnabledState();

  if (!isEnabled) {
    await clearLatestAnalysis();
    removeBadge();
    return;
  }

  initializeAnalysis();
}

async function getEnabledState(): Promise<boolean> {
  const result = await chrome.storage.sync.get("enabled");
  return (result.enabled as boolean | undefined) ?? true;
}

function initializeAnalysis(): void {
  if (!isEnabled) {
    removeBadge();
    return;
  }

  const nextAppDetection = helper.detectNextApp();

  if (!nextAppDetection.isNextApp) {
    removeBadge();
    void clearLatestAnalysis();
    scheduleLoadRetry();
    return;
  }

  hasPendingLoadRetry = false;
  renderBadge({
    title: "Next.js bulundu",
    detail: "Analiz hesaplanıyor...",
    loading: true,
  });
  void updateAnalysis();
}

async function updateAnalysis(): Promise<void> {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      void persistAnalysis();
    });
  });
}

async function persistAnalysis(): Promise<void> {
  const analysis = buildPageAnalysis();
  await chrome.storage.local.set({ latestAnalysis: analysis });
  await persistAnalysisHistory(analysis);

  const primaryMetric =
    analysis.metrics.lcp ??
    analysis.metrics.fcp ??
    analysis.metrics.routeRenderTime;

  renderBadge(
    {
      title: "Next.js bulundu",
      detail:
        primaryMetric !== null
          ? `Analiz hazir: ${primaryMetric.toFixed(0)} ms`
          : "Analiz hazir",
      loading: false,
    },
  );
}

function buildPageAnalysis(): PageAnalysis {
  const metrics = getMetricsSnapshot();
  const signals = getSignalsSnapshot();

  return {
    url: window.location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    isEnabled,
    next: helper.detectNextApp(),
    metrics,
    signals,
    score: buildScore(metrics),
    recommendations: buildRecommendations(metrics, signals),
  };
}

function getMetricsSnapshot(): AnalysisMetrics {
  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];

  return {
    ttfb: navigationEntry?.responseStart ?? null,
    domContentLoaded: navigationEntry?.domContentLoadedEventEnd ?? null,
    loadEvent: navigationEntry?.loadEventEnd ?? null,
    fcp: fcpEntry?.startTime ?? null,
    lcp: latestLcp,
    cls: latestCls > 0 ? latestCls : null,
    routeRenderTime: getRenderTime(),
  };
}

function getSignalsSnapshot(): AnalysisSignals {
  return {
    nextDataSize: helper.getNextDataSize(),
    scriptCount: helper.getScriptCount(),
    domNodeCount: helper.getDomNodeCount(),
    imageMissingDimensionsCount: helper.getImagesMissingDimensionsCount(),
  };
}

function getRenderTime(): number | null {
  if (activePath === initialPath) {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (navigationEntry?.domContentLoadedEventEnd) {
      return navigationEntry.domContentLoadedEventEnd;
    }
  }

  const routeRenderTime = performance.now() - routeMeasureStartedAt;
  return routeRenderTime >= 0 ? routeRenderTime : null;
}

function observeRouteChanges(): void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args): void {
    originalPushState.apply(this, args);
    handleRouteChange();
  };

  history.replaceState = function (...args): void {
    originalReplaceState.apply(this, args);
    handleRouteChange();
  };

  window.addEventListener("popstate", handleRouteChange);
  window.addEventListener("hashchange", handleRouteChange);
}

function handleRouteChange(): void {
  const nextPath = getCurrentRouteKey();

  if (nextPath === activePath) {
    return;
  }

  activePath = nextPath;
  routeMeasureStartedAt = performance.now();
  latestLcp = null;
  latestCls = 0;
  initializeAnalysis();
}

function observeEnabledChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.enabled) {
      return;
    }

    isEnabled = (changes.enabled.newValue as boolean | undefined) ?? true;

    if (!isEnabled) {
      void clearLatestAnalysis();
      removeBadge();
      return;
    }

    routeMeasureStartedAt = performance.now();
    initializeAnalysis();
  });
}

function scheduleLoadRetry(): void {
  if (hasPendingLoadRetry || document.readyState === "complete") {
    return;
  }

  hasPendingLoadRetry = true;

  window.addEventListener(
    "load",
    () => {
      hasPendingLoadRetry = false;
      initializeAnalysis();
    },
    { once: true },
  );
}

function getCurrentRouteKey(): string {
  return window.location.href;
}

function renderBadge(payload: {
  title: string;
  detail: string;
  loading: boolean;
}): void {
  if (!document.body) {
    return;
  }

  const existingBadge = document.querySelector<HTMLDivElement>(
    '[data-extension-badge="true"]',
  );

  if (existingBadge) {
    updateBadgeContent(existingBadge, payload);
    return;
  }

  const badge = document.createElement("div");
  badge.setAttribute("data-extension-badge", "true");
  badge.innerHTML = `
    <div class="next-performance-badge__icon" data-badge-icon></div>
    <div class="next-performance-badge__content">
      <p class="next-performance-badge__title" data-badge-title></p>
      <p class="next-performance-badge__detail" data-badge-detail></p>
    </div>
  `;

  Object.assign(badge.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    width: "292px",
  });

  updateBadgeContent(badge, payload);
  document.body.appendChild(badge);
}

function removeBadge(): void {
  document.querySelector('[data-extension-badge="true"]')?.remove();
}

function updateBadgeContent(
  badge: HTMLDivElement,
  payload: { title: string; detail: string; loading: boolean },
): void {
  badge.className = payload.loading
    ? "next-performance-badge is-loading"
    : "next-performance-badge";

  const title = badge.querySelector<HTMLElement>("[data-badge-title]");
  const detail = badge.querySelector<HTMLElement>("[data-badge-detail]");
  const icon = badge.querySelector<HTMLElement>("[data-badge-icon]");

  if (title) {
    title.textContent = payload.title;
  }

  if (detail) {
    detail.textContent = payload.detail;
  }

  if (icon) {
    icon.textContent = payload.loading ? "" : "N";
  }
}

function injectBadgeStyles(): void {
  if (document.getElementById("next-performance-badge-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "next-performance-badge-style";
  style.textContent = `
    .next-performance-badge {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      font-family: Arial, sans-serif;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.24);
      backdrop-filter: blur(10px);
    }

    .next-performance-badge__icon {
      position: relative;
      display: flex;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
      color: #eff6ff;
      font-size: 13px;
      font-weight: 700;
    }

    .next-performance-badge.is-loading .next-performance-badge__icon::before {
      content: "";
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.28);
      border-top-color: #ffffff;
      border-radius: 999px;
      animation: next-performance-spin 0.8s linear infinite;
    }

    .next-performance-badge__content {
      min-width: 0;
    }

    .next-performance-badge__title {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .next-performance-badge__detail {
      margin: 3px 0 0;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.4;
    }

    @keyframes next-performance-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.documentElement.appendChild(style);
}

async function clearLatestAnalysis(): Promise<void> {
  await chrome.storage.local.remove("latestAnalysis");
}

async function persistAnalysisHistory(analysis: PageAnalysis): Promise<void> {
  const result = await chrome.storage.local.get("analysisHistory");
  const history = ((result.analysisHistory as AnalysisHistory | undefined) ?? []).filter(
    (entry) => entry.url !== analysis.url,
  );
  const nextHistory = [analysis, ...history].slice(0, HISTORY_LIMIT);

  await chrome.storage.local.set({ analysisHistory: nextHistory });
}

function observePerformanceMetrics(): void {
  if (!("PerformanceObserver" in window)) {
    return;
  }

  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const lastEntry = entryList.getEntries().at(-1);
      if (lastEntry) {
        latestLcp = lastEntry.startTime;
      }
    });

    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    latestLcp = null;
  }

  try {
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) {
          latestCls += entry.value;
        }
      }
    });

    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    latestCls = 0;
  }
}

function buildRecommendations(
  metrics: AnalysisMetrics,
  signals: AnalysisSignals,
): string[] {
  const recommendations: string[] = [];

  if (metrics.lcp !== null && metrics.lcp > 2500) {
    recommendations.push("LCP yuksek. Hero gorsellerini ve kritik JS yukunu kontrol et.");
  }

  if (metrics.cls !== null && metrics.cls > 0.1) {
    recommendations.push("CLS yuksek. Gorsellere width/height ekleyip kayma riskini azalt.");
  }

  if (signals.nextDataSize !== null && signals.nextDataSize > 128000) {
    recommendations.push("`__NEXT_DATA__` buyuk. Sayfaya giden veri miktarini azalt.");
  }

  if (signals.imageMissingDimensionsCount > 0) {
    recommendations.push("Boyutu eksik gorseller var. Layout shift olusabilir.");
  }

  if (signals.scriptCount > 20) {
    recommendations.push("Script sayisi yuksek. Gereksiz istemci tarafli kodu azalt.");
  }

  return recommendations.slice(0, 3);
}

function buildScore(metrics: AnalysisMetrics): AnalysisScore {
  const statuses = {
    lcp: getLcpStatus(metrics.lcp),
    cls: getClsStatus(metrics.cls),
    ttfb: getTtfbStatus(metrics.ttfb),
    render: getRenderStatus(metrics.routeRenderTime),
  };

  const values = [
    getStatusPoints(statuses.lcp),
    getStatusPoints(statuses.cls),
    getStatusPoints(statuses.ttfb),
    getStatusPoints(statuses.render),
  ];
  const overall = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    overall,
    label: getOverallStatus(overall),
    statuses,
  };
}

function getLcpStatus(value: number | null): MetricStatus {
  if (value === null) return "unknown";
  if (value <= 2500) return "good";
  if (value <= 4000) return "warning";
  return "critical";
}

function getClsStatus(value: number | null): MetricStatus {
  if (value === null) return "unknown";
  if (value <= 0.1) return "good";
  if (value <= 0.25) return "warning";
  return "critical";
}

function getTtfbStatus(value: number | null): MetricStatus {
  if (value === null) return "unknown";
  if (value <= 800) return "good";
  if (value <= 1800) return "warning";
  return "critical";
}

function getRenderStatus(value: number | null): MetricStatus {
  if (value === null) return "unknown";
  if (value <= 1000) return "good";
  if (value <= 2500) return "warning";
  return "critical";
}

function getStatusPoints(status: MetricStatus): number {
  if (status === "good") return 100;
  if (status === "warning") return 65;
  if (status === "critical") return 30;
  return 50;
}

function getOverallStatus(score: number): MetricStatus {
  if (score >= 85) return "good";
  if (score >= 60) return "warning";
  return "critical";
}
