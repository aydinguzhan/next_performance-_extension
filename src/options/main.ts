import type { AnalysisHistory, PageAnalysis } from "../content/helper/types";
import { extensionStorage } from "../shared/storage";
import "./style.css";

type SummaryStats = {
  averageLcp: number | null;
  averageCls: number | null;
  averageTtfb: number | null;
  averageRender: number | null;
  slowestRoute: string;
  riskyRoute: string;
};

const METRIC_HELP = {
  lcp: "Largest Contentful Paint. Sayfadaki en buyuk gorunur icerigin ne kadar gec cizildigini gosterir.",
  cls: "Cumulative Layout Shift. Sayfa acilirken veya gezerken ne kadar beklenmedik kayma oldugunu gosterir.",
  ttfb: "Time to First Byte. Sunucunun ilk bayti gondermeye ne kadar gec basladigini olcer.",
  render: "Bu extension icin yaklasik route gorunur olma suresi. Ilk yukleme veya route degisimi sonrasi hesaplanir.",
  fcp: "First Contentful Paint. Ekranda ilk anlamli icerigin ne zaman gorundugunu gosterir.",
  scripts: "Sayfada yuklenen script sayisi. Fazla istemci tarafi kod agirlik yaratabilir.",
  dom: "Toplam DOM node sayisi. Yuksek sayilar render ve hydration maliyetini artirabilir.",
  imageRisk: "Width/height eksik gorsellerin sayisi. Layout shift riskini artirabilir.",
} as const;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Options root element not found.");
}

const enabled = await extensionStorage.get("enabled", true);
const latestAnalysis = await extensionStorage.getLocal<PageAnalysis | null>(
  "latestAnalysis",
  null,
);
const analysisHistory = await extensionStorage.getLocal<AnalysisHistory>(
  "analysisHistory",
  [],
);

const normalizedLatestAnalysis = latestAnalysis ? normalizeAnalysis(latestAnalysis) : null;
const normalizedHistory = analysisHistory.map(normalizeAnalysis);

renderDashboard(enabled, normalizedLatestAnalysis, normalizedHistory);

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync" && areaName !== "local") {
    return;
  }

  const nextEnabled =
    areaName === "sync" && changes.enabled
      ? ((changes.enabled.newValue as boolean | undefined) ?? true)
      : await extensionStorage.get("enabled", true);
  const nextLatestAnalysis =
    areaName === "local" && changes.latestAnalysis
      ? normalizeNullableAnalysis(
          (changes.latestAnalysis.newValue as PageAnalysis | undefined) ?? null,
        )
      : await extensionStorage.getLocal<PageAnalysis | null>("latestAnalysis", null);
  const nextHistory =
    areaName === "local" && changes.analysisHistory
      ? (((changes.analysisHistory.newValue as AnalysisHistory | undefined) ?? []).map(
          normalizeAnalysis,
        ))
      : await extensionStorage.getLocal<AnalysisHistory>("analysisHistory", []);

  renderDashboard(
    nextEnabled,
    normalizeNullableAnalysis(nextLatestAnalysis),
    nextHistory.map(normalizeAnalysis),
  );
});

function renderDashboard(
  currentEnabled: boolean,
  currentLatestAnalysis: PageAnalysis | null,
  currentHistory: AnalysisHistory,
): void {
  const stats = getSummaryStats(currentHistory);

  app!.innerHTML = `
    <main class="dashboard">
      <section class="hero">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1>Next Performance Console</h1>
          <p class="description">
            Route gecmisini, performans trendlerini ve riskli sayfalari grafiklerle izle.
          </p>
        </div>
        <div class="hero-actions">
          <label class="toggle">
            <input id="enabled-checkbox" type="checkbox" ${currentEnabled ? "checked" : ""} />
            <span>${currentEnabled ? "Analiz aktif" : "Analiz kapali"}</span>
          </label>
          <div class="export-row">
            <button id="export-json-button" class="ghost-button">JSON Export</button>
            <button id="export-markdown-button" class="ghost-button">Markdown Export</button>
          </div>
        </div>
      </section>

      <section class="kpi-grid">
        ${renderKpiCard("Skor", currentLatestAnalysis ? `${currentLatestAnalysis.score.overall}` : "-", currentLatestAnalysis ? formatStatusLabel(currentLatestAnalysis.score.label) : "Skor yok", "Genel sayfa performans puani")}
        ${renderKpiCard("Ort. LCP", formatMetric(stats.averageLcp, "ms"), stats.slowestRoute, METRIC_HELP.lcp)}
        ${renderKpiCard("Ort. CLS", formatMetric(stats.averageCls, ""), stats.riskyRoute, METRIC_HELP.cls)}
        ${renderKpiCard("Ort. TTFB", formatMetric(stats.averageTtfb, "ms"), "Sunucu yanit hizi", METRIC_HELP.ttfb)}
        ${renderKpiCard("Ort. Render", formatMetric(stats.averageRender, "ms"), `${currentHistory.length} kayit`, METRIC_HELP.render)}
      </section>

      <section class="education-panel panel">
        <div class="panel-header">
          <div>
            <p class="section-label">Nasil okunur</p>
            <h2>Bu ekran ne anlatiyor?</h2>
          </div>
        </div>
        <div class="education-grid">
          ${renderGuideItem("LCP", "En buyuk icerigin gec gorunup gorunmedigini anlamak icin bak.")} 
          ${renderGuideItem("CLS", "Kayma problemi varsa once gorsel boyutlari ve gec eklenen bloklari kontrol et.")}
          ${renderGuideItem("TTFB", "Sorun burada yuksekse uygulama degil sunucu veya ag etkisi agir olabilir.")}
          ${renderGuideItem("Render", "Route gecislerinde kullaniciya ne kadar hizli cevap verdigini izlemek icin bak.")}
          ${renderGuideItem("Threshold", "Kartlardaki renkli etiketler good, warning ve critical seviyelerini gosterir.")}
          ${renderGuideItem("Score", "Skor; LCP, CLS, TTFB ve Render durumlarinin ortalama puanidir.")}
        </div>
      </section>

      <section class="chart-grid">
        <article class="panel chart-panel">
          <div class="panel-header">
            <div>
              <p class="section-label">Trend</p>
              <h2>Performans zaman cizgisi</h2>
            </div>
            <div class="legend">
              <span><i class="legend-dot lcp"></i>LCP</span>
              <span><i class="legend-dot ttfb"></i>TTFB</span>
              <span><i class="legend-dot render"></i>Render</span>
            </div>
          </div>
          ${renderTimelineChart(currentHistory)}
        </article>

        <article class="panel chart-panel">
          <div class="panel-header">
            <div>
              <p class="section-label">Karsilastirma</p>
              <h2>Route lider tablosu</h2>
            </div>
          </div>
          ${renderRouteBarChart(currentHistory)}
        </article>
      </section>

      <section class="overview-grid">
        ${renderLatestAnalysis(currentLatestAnalysis, currentEnabled)}
        <section class="panel chart-panel">
          <div class="panel-header">
            <div>
              <p class="section-label">Stability</p>
              <h2>CLS ve gorsel risk dagilimi</h2>
            </div>
          </div>
          ${renderRiskBars(currentHistory)}
        </section>
      </section>

      <section class="history-panel">
        <div class="panel-header">
          <div>
            <p class="section-label">Gecmis</p>
            <h2>Son route analizleri</h2>
          </div>
          <button id="clear-history-button" class="ghost-button">Gecmisi Temizle</button>
        </div>
        ${renderHistory(currentHistory)}
      </section>
    </main>
  `;

  bindDashboardEvents();
}

function renderLatestAnalysis(
  latestAnalysis: PageAnalysis | null,
  enabled: boolean,
): string {
  if (!enabled) {
    return `
      <section class="panel latest-panel empty-panel">
        <h2>Analiz kapali</h2>
        <p>Extension tekrar aktif oldugunda burada son sayfa ozeti gorunecek.</p>
      </section>
    `;
  }

  if (!latestAnalysis) {
    return `
      <section class="panel latest-panel empty-panel">
        <h2>Henuz analiz yok</h2>
        <p>Bir Next.js sayfasinda gezindikce bu panel son kaydi gosterecek.</p>
      </section>
    `;
  }

  return `
    <section class="panel latest-panel">
      <div class="panel-header">
        <div>
          <p class="section-label">Son analiz</p>
          <h2>${latestAnalysis.title || "Baslik bulunamadi"}</h2>
        </div>
        <div class="latest-badges">
          <div class="status-chip ${getStatusClass(latestAnalysis.score.label)}">${formatStatusLabel(latestAnalysis.score.label)}</div>
          <div class="router-chip">${formatRouter(latestAnalysis.next.nextAppKind)}</div>
        </div>
      </div>
      <p class="url">${latestAnalysis.url}</p>
      <div class="score-strip">
        <div class="score-ring ${getStatusClass(latestAnalysis.score.label)}">${latestAnalysis.score.overall}</div>
        <div class="threshold-list">
          ${renderThresholdItem("LCP", latestAnalysis.score.statuses.lcp)}
          ${renderThresholdItem("CLS", latestAnalysis.score.statuses.cls)}
          ${renderThresholdItem("TTFB", latestAnalysis.score.statuses.ttfb)}
          ${renderThresholdItem("Render", latestAnalysis.score.statuses.render)}
        </div>
      </div>
      <div class="metric-row">
        ${renderMetric("TTFB", formatMetric(latestAnalysis.metrics.ttfb, "ms"), METRIC_HELP.ttfb)}
        ${renderMetric("FCP", formatMetric(latestAnalysis.metrics.fcp, "ms"), METRIC_HELP.fcp)}
        ${renderMetric("LCP", formatMetric(latestAnalysis.metrics.lcp, "ms"), METRIC_HELP.lcp)}
        ${renderMetric("CLS", formatMetric(latestAnalysis.metrics.cls, ""), METRIC_HELP.cls)}
        ${renderMetric("Render", formatMetric(latestAnalysis.metrics.routeRenderTime, "ms"), METRIC_HELP.render)}
        ${renderMetric("Scripts", String(latestAnalysis.signals.scriptCount), METRIC_HELP.scripts)}
      </div>
      <div class="recommendations">
        <p class="section-label">Oneriler</p>
        <ul>${renderRecommendations(latestAnalysis.recommendations)}</ul>
      </div>
    </section>
  `;
}

function renderHistory(history: AnalysisHistory): string {
  if (history.length === 0) {
    return `<div class="panel empty-panel"><p>Kayitli route gecmisi bulunmuyor.</p></div>`;
  }

  return `
    <div class="history-list">
      ${history
        .map(
          (entry) => `
            <article class="history-item">
              <div class="history-head">
                <div>
                  <h3>${entry.title || "Baslik bulunamadi"}</h3>
                  <p class="url">${entry.url}</p>
                </div>
                <div class="history-meta">
                  <span class="status-chip small ${getStatusClass(entry.score.label)}">${entry.score.overall}</span>
                  <span class="router-chip small">${formatRouter(entry.next.nextAppKind)}</span>
                  <span>${formatDate(entry.capturedAt)}</span>
                </div>
              </div>
              <div class="history-metrics">
                ${renderMetric("LCP", formatMetric(entry.metrics.lcp, "ms"), METRIC_HELP.lcp)}
                ${renderMetric("CLS", formatMetric(entry.metrics.cls, ""), METRIC_HELP.cls)}
                ${renderMetric("Render", formatMetric(entry.metrics.routeRenderTime, "ms"), METRIC_HELP.render)}
                ${renderMetric("DOM", String(entry.signals.domNodeCount), METRIC_HELP.dom)}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderKpiCard(label: string, value: string, hint: string, help: string): string {
  return `
    <article class="panel kpi-card">
      <div class="metric-head">
        <p class="section-label">${label}</p>
        ${renderInfoBadge(help)}
      </div>
      <strong class="kpi-value">${value}</strong>
      <p class="kpi-hint">${hint}</p>
    </article>
  `;
}

function renderMetric(label: string, value: string, help: string): string {
  return `
    <div class="metric-card">
      <div class="metric-head">
        <span class="metric-label">${label}</span>
        ${renderInfoBadge(help)}
      </div>
      <strong class="metric-value">${value}</strong>
    </div>
  `;
}

function renderGuideItem(title: string, description: string): string {
  return `
    <article class="guide-item">
      <h3>${title}</h3>
      <p>${description}</p>
    </article>
  `;
}

function renderThresholdItem(label: string, status: PageAnalysis["score"]["label"]): string {
  return `
    <div class="threshold-item">
      <span>${label}</span>
      <span class="status-chip small ${getStatusClass(status)}">${formatStatusLabel(status)}</span>
    </div>
  `;
}

function renderInfoBadge(text: string): string {
  return `
    <span class="info-badge" tabindex="0" aria-label="${text}">
      i
      <span class="info-tooltip">${text}</span>
    </span>
  `;
}

function renderRecommendations(recommendations: string[]): string {
  if (recommendations.length === 0) {
    return "<li>Su an icin kritik bir oneri yok.</li>";
  }

  return recommendations.map((item) => `<li>${item}</li>`).join("");
}

function formatStatusLabel(status: PageAnalysis["score"]["label"]): string {
  if (status === "good") return "Good";
  if (status === "warning") return "Warning";
  if (status === "critical") return "Critical";
  return "Unknown";
}

function renderTimelineChart(history: AnalysisHistory): string {
  if (history.length === 0) {
    return `<div class="empty-chart">Grafik icin yeterli veri yok.</div>`;
  }

  const chartData = [...history].reverse().slice(-8);
  const maxValue = Math.max(
    ...chartData.flatMap((entry) => [
      entry.metrics.lcp ?? 0,
      entry.metrics.ttfb ?? 0,
      entry.metrics.routeRenderTime ?? 0,
    ]),
    100,
  );

  const lcpPoints = buildPoints(chartData, maxValue, (entry) => entry.metrics.lcp);
  const ttfbPoints = buildPoints(chartData, maxValue, (entry) => entry.metrics.ttfb);
  const renderPoints = buildPoints(
    chartData,
    maxValue,
    (entry) => entry.metrics.routeRenderTime,
  );

  return `
    <div class="chart-shell">
      <svg viewBox="0 0 520 240" class="timeline-chart" aria-label="Performance timeline">
        ${renderGridLines()}
        <polyline class="line lcp" points="${lcpPoints}" />
        <polyline class="line ttfb" points="${ttfbPoints}" />
        <polyline class="line render" points="${renderPoints}" />
      </svg>
      <div class="axis-row">
        ${chartData
          .map((entry) => `<span>${formatShortTime(entry.capturedAt)}</span>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderRouteBarChart(history: AnalysisHistory): string {
  if (history.length === 0) {
    return `<div class="empty-chart">Route karsilastirma icin veri yok.</div>`;
  }

  const topRoutes = [...history]
    .sort((a, b) => (b.metrics.lcp ?? 0) - (a.metrics.lcp ?? 0))
    .slice(0, 6);
  const maxLcp = Math.max(...topRoutes.map((entry) => entry.metrics.lcp ?? 0), 100);

  return `
    <div class="bar-list">
      ${topRoutes
        .map((entry) => {
          const ratio = ((entry.metrics.lcp ?? 0) / maxLcp) * 100;
          return `
            <div class="bar-row">
              <div class="bar-copy">
                <strong>${truncate(entry.title || entry.url, 36)}</strong>
                <span>${formatMetric(entry.metrics.lcp, "ms")}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${Math.max(ratio, 6)}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRiskBars(history: AnalysisHistory): string {
  if (history.length === 0) {
    return `<div class="empty-chart">Risk paneli icin veri yok.</div>`;
  }

  const top = [...history]
    .sort(
      (a, b) =>
        (b.metrics.cls ?? 0) + b.signals.imageMissingDimensionsCount -
        ((a.metrics.cls ?? 0) + a.signals.imageMissingDimensionsCount),
    )
    .slice(0, 5);

  const maxRisk = Math.max(
    ...top.map((entry) => (entry.metrics.cls ?? 0) * 100 + entry.signals.imageMissingDimensionsCount),
    1,
  );

  return `
    <div class="risk-list">
      ${top
        .map((entry) => {
          const clsScore = (entry.metrics.cls ?? 0) * 100;
          const imageScore = entry.signals.imageMissingDimensionsCount;
          const total = clsScore + imageScore;
          const width = (total / maxRisk) * 100;

          return `
            <div class="risk-row">
              <div class="bar-copy">
                <strong>${truncate(entry.title || entry.url, 32)}</strong>
                <span>CLS ${formatMetric(entry.metrics.cls, "")} · Img ${entry.signals.imageMissingDimensionsCount}</span>
              </div>
              <div class="bar-track risk-track">
                <div class="bar-fill risk-fill" style="width: ${Math.max(width, 8)}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getSummaryStats(history: AnalysisHistory): SummaryStats {
  return {
    averageLcp: getAverage(history.map((entry) => entry.metrics.lcp)),
    averageCls: getAverage(history.map((entry) => entry.metrics.cls)),
    averageTtfb: getAverage(history.map((entry) => entry.metrics.ttfb)),
    averageRender: getAverage(history.map((entry) => entry.metrics.routeRenderTime)),
    slowestRoute: getRouteLabel(
      [...history].sort((a, b) => (b.metrics.lcp ?? 0) - (a.metrics.lcp ?? 0))[0],
    ),
    riskyRoute: getRouteLabel(
      [...history].sort(
        (a, b) =>
          (b.metrics.cls ?? 0) + b.signals.imageMissingDimensionsCount -
          ((a.metrics.cls ?? 0) + a.signals.imageMissingDimensionsCount),
      )[0],
    ),
  };
}

function getAverage(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) {
    return null;
  }

  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

function buildPoints(
  history: AnalysisHistory,
  maxValue: number,
  selector: (entry: PageAnalysis) => number | null,
): string {
  const width = 520;
  const height = 240;
  const paddingX = 24;
  const paddingY = 20;
  const step = history.length > 1 ? (width - paddingX * 2) / (history.length - 1) : 0;

  return history
    .map((entry, index) => {
      const value = selector(entry) ?? 0;
      const x = paddingX + step * index;
      const y = height - paddingY - (value / maxValue) * (height - paddingY * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function renderGridLines(): string {
  return `
    <line x1="24" y1="24" x2="496" y2="24" class="grid-line" />
    <line x1="24" y1="80" x2="496" y2="80" class="grid-line" />
    <line x1="24" y1="136" x2="496" y2="136" class="grid-line" />
    <line x1="24" y1="192" x2="496" y2="192" class="grid-line" />
  `;
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) {
    return "-";
  }

  const formatted = unit === "" ? value.toFixed(3) : value.toFixed(0);
  return `${formatted}${unit}`;
}

function formatRouter(router: PageAnalysis["next"]["nextAppKind"]): string {
  if (router === "app-router") {
    return "App Router";
  }

  if (router === "pages-router") {
    return "Pages Router";
  }

  return "Unknown";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortTime(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRouteLabel(entry: PageAnalysis | undefined): string {
  if (!entry) {
    return "Kayit yok";
  }

  return truncate(entry.title || entry.url, 28);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function bindDashboardEvents(): void {
  const checkbox = document.querySelector<HTMLInputElement>("#enabled-checkbox");
  const clearButton = document.querySelector<HTMLButtonElement>("#clear-history-button");
  const exportJsonButton = document.querySelector<HTMLButtonElement>("#export-json-button");
  const exportMarkdownButton = document.querySelector<HTMLButtonElement>("#export-markdown-button");

  checkbox?.addEventListener("change", async (event) => {
    const target = event.currentTarget as HTMLInputElement;
    await extensionStorage.set("enabled", target.checked);
  });

  clearButton?.addEventListener("click", async () => {
    await extensionStorage.removeLocal("analysisHistory");
    renderDashboard(
      await extensionStorage.get("enabled", true),
      normalizeNullableAnalysis(
        await extensionStorage.getLocal<PageAnalysis | null>("latestAnalysis", null),
      ),
      [],
    );
  });

  exportJsonButton?.addEventListener("click", async () => {
    const history = await extensionStorage.getLocal<AnalysisHistory>("analysisHistory", []);
    downloadFile("next-performance-report.json", JSON.stringify(history, null, 2), "application/json");
  });

  exportMarkdownButton?.addEventListener("click", async () => {
    const history = (
      await extensionStorage.getLocal<AnalysisHistory>("analysisHistory", [])
    ).map(normalizeAnalysis);
    downloadFile("next-performance-report.md", formatHistoryAsMarkdown(history), "text/markdown");
  });
}

function downloadFile(filename: string, content: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatHistoryAsMarkdown(history: AnalysisHistory): string {
  if (history.length === 0) {
    return "# Next Performance Report\n\nNo analysis history available.";
  }

  return [
    "# Next Performance Report",
    "",
    ...history.map((entry) =>
      [
        `## ${entry.title || entry.url}`,
        `- URL: ${entry.url}`,
        `- Score: ${entry.score.overall} (${formatStatusLabel(entry.score.label)})`,
        `- Router: ${formatRouter(entry.next.nextAppKind)}`,
        `- LCP: ${formatMetric(entry.metrics.lcp, "ms")}`,
        `- CLS: ${formatMetric(entry.metrics.cls, "")}`,
        `- TTFB: ${formatMetric(entry.metrics.ttfb, "ms")}`,
        `- Render: ${formatMetric(entry.metrics.routeRenderTime, "ms")}`,
        `- Scripts: ${entry.signals.scriptCount}`,
        `- DOM Nodes: ${entry.signals.domNodeCount}`,
        `- Image Risk: ${entry.signals.imageMissingDimensionsCount}`,
        "- Recommendations:",
        ...(entry.recommendations.length > 0
          ? entry.recommendations.map((item) => `  - ${item}`)
          : ["  - No critical recommendation."]),
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

function getStatusClass(status: PageAnalysis["score"]["label"]): string {
  return `is-${status}`;
}

function normalizeNullableAnalysis(
  analysis: PageAnalysis | null,
): PageAnalysis | null {
  return analysis ? normalizeAnalysis(analysis) : null;
}

function normalizeAnalysis(analysis: PageAnalysis): PageAnalysis {
  if (analysis.score) {
    return analysis;
  }

  const statuses = {
    lcp: getLcpStatus(analysis.metrics.lcp),
    cls: getClsStatus(analysis.metrics.cls),
    ttfb: getTtfbStatus(analysis.metrics.ttfb),
    render: getRenderStatus(analysis.metrics.routeRenderTime),
  };
  const values = [
    getStatusPoints(statuses.lcp),
    getStatusPoints(statuses.cls),
    getStatusPoints(statuses.ttfb),
    getStatusPoints(statuses.render),
  ];
  const overall = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    ...analysis,
    score: {
      overall,
      label: getOverallStatus(overall),
      statuses,
    },
  };
}

function getLcpStatus(value: number | null): PageAnalysis["score"]["label"] {
  if (value === null) return "unknown";
  if (value <= 2500) return "good";
  if (value <= 4000) return "warning";
  return "critical";
}

function getClsStatus(value: number | null): PageAnalysis["score"]["label"] {
  if (value === null) return "unknown";
  if (value <= 0.1) return "good";
  if (value <= 0.25) return "warning";
  return "critical";
}

function getTtfbStatus(value: number | null): PageAnalysis["score"]["label"] {
  if (value === null) return "unknown";
  if (value <= 800) return "good";
  if (value <= 1800) return "warning";
  return "critical";
}

function getRenderStatus(value: number | null): PageAnalysis["score"]["label"] {
  if (value === null) return "unknown";
  if (value <= 1000) return "good";
  if (value <= 2500) return "warning";
  return "critical";
}

function getStatusPoints(status: PageAnalysis["score"]["label"]): number {
  if (status === "good") return 100;
  if (status === "warning") return 65;
  if (status === "critical") return 30;
  return 50;
}

function getOverallStatus(score: number): PageAnalysis["score"]["label"] {
  if (score >= 85) return "good";
  if (score >= 60) return "warning";
  return "critical";
}
