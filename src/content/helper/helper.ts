import type { NextAppDetectionResult, NextAppKind } from "./types";

export class Helper {
  constructor(private document: Document) {}

  detectNextApp(): NextAppDetectionResult {
    const hasNextDataScript = !!this.document.querySelector('script[id="__NEXT_DATA__"]');
    const hasNextHeadMeta = !!this.document.querySelector('meta[name="next-head-count"]');
    const hasNextAssets = this.getNextAssetCount() > 0;
    const hasAppRouterFlightData = this.hasAppRouterFlightData();
    const hasNextRoot = !!this.document.querySelector("#__next");
    const nextAppKind = this.getNextAppKind(hasNextDataScript, hasAppRouterFlightData);

    return {
      isNextApp:
        hasNextDataScript ||
        hasNextHeadMeta ||
        hasNextAssets ||
        hasAppRouterFlightData ||
        hasNextRoot,
      nextAppKind,
      hasNextDataScript,
      hasNextHeadMeta,
      hasNextAssets,
      hasAppRouterFlightData,
      hasNextRoot,
    };
  }

  getNextDataSize(): number | null {
    const nextDataScript = this.document.querySelector<HTMLScriptElement>(
      'script[id="__NEXT_DATA__"]',
    );

    if (!nextDataScript?.textContent) {
      return null;
    }

    return new TextEncoder().encode(nextDataScript.textContent).length;
  }

  getScriptCount(): number {
    return this.document.scripts.length;
  }

  getDomNodeCount(): number {
    return this.document.getElementsByTagName("*").length;
  }

  getImagesMissingDimensionsCount(): number {
    return Array.from(this.document.images).filter((image) => {
      return !image.getAttribute("width") || !image.getAttribute("height");
    }).length;
  }

  private getNextAssetCount(): number {
    const nextAssetSelectors = [
      'script[src*="/_next/"]',
      'link[href*="/_next/"]',
      'img[src*="/_next/"]',
      'script[src*="/_next/static/"]',
      'link[href*="/_next/static/"]',
      'link[rel="preload"][href*="/_next/"]',
    ];

    return nextAssetSelectors.reduce((count, selector) => {
      return count + this.document.querySelectorAll(selector).length;
    }, 0);
  }

  private hasAppRouterFlightData(): boolean {
    return Array.from(this.document.scripts).some((script) =>
      script.textContent?.includes("self.__next_f.push"),
    );
  }

  private getNextAppKind(
    hasNextDataScript: boolean,
    hasAppRouterFlightData: boolean,
  ): NextAppKind {
    if (hasAppRouterFlightData) {
      return "app-router";
    }

    if (hasNextDataScript) {
      return "pages-router";
    }

    return "unknown";
  }
}
