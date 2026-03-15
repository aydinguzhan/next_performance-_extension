import type { PageAnalysis } from "../content/helper/types";
import { extensionStorage } from "../shared/storage";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Popup root element not found.");
}

const currentStatus = await extensionStorage.get("enabled", true);
const latestAnalysis = await getLatestAnalysis();

app.innerHTML = `
  <main class="popup">
    <section class="hero">
      <p class="eyebrow">Developer Tool</p>
      <div class="hero-top">
        <div>
          <h1>Next Performance</h1>
          <p class="description">Next.js sayfalari icin hizli teknik ozet.</p>
        </div>
        <div class="status-pill ${currentStatus ? "is-active" : "is-passive"}" id="status-pill">
          ${currentStatus ? "Aktif" : "Pasif"}
        </div>
      </div>
      <div class="actions">
        <button id="toggle-button" class="toggle-button">
          ${currentStatus ? "Analizi Kapat" : "Analizi Ac"}
        </button>
        <button id="copy-button" class="copy-button">
          Raporu Kopyala
        </button>
        <button id="dashboard-button" class="dashboard-button">
          Dashboard'u Ac
        </button>
      </div>
      <p class="copy-feedback" id="copy-feedback"></p>
    </section>
    <section id="analysis">
      ${renderAnalysis(latestAnalysis, currentStatus)}
    </section>
  </main>
`;

const toggleButton = document.querySelector<HTMLButtonElement>("#toggle-button");
const copyButton = document.querySelector<HTMLButtonElement>("#copy-button");
const dashboardButton = document.querySelector<HTMLButtonElement>("#dashboard-button");
const analysis = document.querySelector<HTMLElement>("#analysis");
const copyFeedback = document.querySelector<HTMLParagraphElement>("#copy-feedback");
const statusPill = document.querySelector<HTMLDivElement>("#status-pill");

toggleButton?.addEventListener("click", async () => {
  const nextValue = !(await extensionStorage.get("enabled", true));
  await extensionStorage.set("enabled", nextValue);

  toggleButton.textContent = nextValue ? "Analizi Kapat" : "Analizi Ac";
  updateStatusPill(nextValue);

  if (analysis) {
    const nextAnalysis = nextValue ? await getLatestAnalysis() : null;
    analysis.innerHTML = renderAnalysis(nextAnalysis, nextValue);
  }
});

copyButton?.addEventListener("click", async () => {
  const enabled = await extensionStorage.get("enabled", true);
  const analysisToCopy = enabled ? await getLatestAnalysis() : null;

  if (!enabled || !analysisToCopy) {
    setCopyFeedback("Kopyalanacak analiz bulunamadi.");
    return;
  }

  try {
    await navigator.clipboard.writeText(formatAnalysisForCopy(analysisToCopy));
    setCopyFeedback("Analiz panoya kopyalandi.");
  } catch {
    setCopyFeedback("Kopyalama basarisiz oldu.");
  }
});

dashboardButton?.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.latestAnalysis || !analysis) {
    return;
  }

  analysis.innerHTML = renderAnalysis(
    (changes.latestAnalysis.newValue as PageAnalysis | undefined) ?? null,
    true,
  );
});

async function getLatestAnalysis(): Promise<PageAnalysis | null> {
  const result = await chrome.storage.local.get("latestAnalysis");
  return (result.latestAnalysis as PageAnalysis | undefined) ?? null;
}

function renderAnalysis(
  latestAnalysis: PageAnalysis | null,
  enabled: boolean,
): string {
  if (!enabled) {
    return `
      <section class="panel empty-state">
        <h2>Analiz kapali</h2>
        <p>Popup uzerinden analizi tekrar acar acmaz bu sekmeye ait veriler burada gorunecek.</p>
      </section>
    `;
  }

  if (!latestAnalysis) {
    return `
      <section class="panel empty-state">
        <h2>Analiz bekleniyor</h2>
        <p>Bu sekmede henuz veri yok. Next.js sayfasini yenileyip tekrar dene.</p>
      </section>
    `;
  }

  const recommendations =
    latestAnalysis.recommendations.length > 0
      ? latestAnalysis.recommendations
          .map((item) => `<li class="recommendation-item">${item}</li>`)
          .join("")
      : '<li class="recommendation-item">Su an icin kritik bir oneri yok.</li>';

  return `
    <section class="panel summary-panel">
      <div class="summary-header">
        <div>
          <p class="section-label">Sayfa</p>
          <h2>${latestAnalysis.title || "Baslik bulunamadi"}</h2>
        </div>
        <div class="router-badge">${formatRouterLabel(latestAnalysis.next.nextAppKind)}</div>
      </div>
      <p class="url">${latestAnalysis.url}</p>
    </section>

    <section class="metric-grid">
      ${renderMetricCard("TTFB", formatMetric(latestAnalysis.metrics.ttfb, "ms"), "Sunucu yanit hizi")}
      ${renderMetricCard("FCP", formatMetric(latestAnalysis.metrics.fcp, "ms"), "Ilk icerik gorunumu")}
      ${renderMetricCard("LCP", formatMetric(latestAnalysis.metrics.lcp, "ms"), "En buyuk icerik boyamasi")}
      ${renderMetricCard("CLS", formatMetric(latestAnalysis.metrics.cls, ""), "Gorsel kayma puani")}
      ${renderMetricCard("Render", formatMetric(latestAnalysis.metrics.routeRenderTime, "ms"), "Yaklasik route suresi")}
      ${renderMetricCard("Scripts", String(latestAnalysis.signals.scriptCount), "Script sayisi")}
      ${renderMetricCard("DOM", String(latestAnalysis.signals.domNodeCount), "Toplam dugum")}
      ${renderMetricCard(
        "Image Risk",
        String(latestAnalysis.signals.imageMissingDimensionsCount),
        "Boyutu eksik gorseller",
      )}
    </section>

    <section class="panel recommendations-panel">
      <div class="panel-heading">
        <p class="section-label">Oneriler</p>
        <span class="captured-at">${formatCapturedAt(latestAnalysis.capturedAt)}</span>
      </div>
      <ul class="recommendation-list">${recommendations}</ul>
    </section>
  `;
}

function renderMetricCard(label: string, value: string, hint: string): string {
  return `
    <article class="metric-card">
      <p class="metric-label">${label}</p>
      <p class="metric-value">${value}</p>
      <p class="metric-hint">${hint}</p>
    </article>
  `;
}

function updateStatusPill(enabled: boolean): void {
  if (!statusPill) {
    return;
  }

  statusPill.textContent = enabled ? "Aktif" : "Pasif";
  statusPill.classList.toggle("is-active", enabled);
  statusPill.classList.toggle("is-passive", !enabled);
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) {
    return "-";
  }

  const formatted = unit === "" ? value.toFixed(3) : value.toFixed(0);
  return `${formatted}${unit}`;
}

function formatRouterLabel(router: PageAnalysis["next"]["nextAppKind"]): string {
  if (router === "app-router") {
    return "App Router";
  }

  if (router === "pages-router") {
    return "Pages Router";
  }

  return "Router bilinmiyor";
}

function formatCapturedAt(capturedAt: string): string {
  const date = new Date(capturedAt);
  return `Son olcum ${date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatAnalysisForCopy(latestAnalysis: PageAnalysis): string {
  const recommendationText =
    latestAnalysis.recommendations.length > 0
      ? latestAnalysis.recommendations.map((item) => `- ${item}`).join("\n")
      : "- Su an icin kritik bir oneri yok.";

  return [
    "Next Performance Analysis",
    `URL: ${latestAnalysis.url}`,
    `Router: ${latestAnalysis.next.nextAppKind}`,
    `TTFB: ${formatMetric(latestAnalysis.metrics.ttfb, "ms")}`,
    `FCP: ${formatMetric(latestAnalysis.metrics.fcp, "ms")}`,
    `LCP: ${formatMetric(latestAnalysis.metrics.lcp, "ms")}`,
    `CLS: ${formatMetric(latestAnalysis.metrics.cls, "")}`,
    `Render: ${formatMetric(latestAnalysis.metrics.routeRenderTime, "ms")}`,
    `Script: ${latestAnalysis.signals.scriptCount}`,
    `DOM Node: ${latestAnalysis.signals.domNodeCount}`,
    `Eksik gorsel boyutu: ${latestAnalysis.signals.imageMissingDimensionsCount}`,
    "Oneriler:",
    recommendationText,
  ].join("\n");
}

function setCopyFeedback(message: string): void {
  if (!copyFeedback) {
    return;
  }

  copyFeedback.textContent = message;
}
