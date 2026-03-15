# Chrome Web Store Listing

## Name
Next Performance Extension

## Short Description
Analyze Next.js pages with route history, performance signals, dashboard charts, and developer-friendly recommendations.

## Detailed Description
Next Performance Extension is a Chrome extension built for developers working on Next.js applications.

It helps you inspect route-level performance directly in the browser without leaving the page.

What it does:
- Detects Next.js pages automatically
- Measures key page signals such as TTFB, FCP, LCP, CLS, and route render time
- Shows a quick popup summary for the current page
- Provides a dashboard with charts, route history, and performance trends
- Highlights useful signals like script count, DOM size, image layout risk, and Next.js-specific clues
- Generates developer-focused recommendations based on the collected analysis
- Lets you export results for debugging and sharing

This extension is useful for frontend developers, performance-focused teams, and anyone who wants faster feedback while working on Next.js pages.

## Suggested Category
Developer Tools

## Privacy Notes
- The extension reads performance-related page signals locally in the browser
- Analysis results are stored in Chrome extension storage for the popup and dashboard UI
- The current version does not require any third-party API or remote AI service
- No user account is required

## Recommended Store Fields

### Single Purpose
Analyze Next.js pages and surface route-level performance insights for developers.

### Permissions Justification
- `storage`: Save settings, latest analysis, and route history
- `activeTab`: Support extension interaction with the current tab context
- `scripting`: Used by the extension runtime setup for tab-level behavior
- `<all_urls>` host permission: Required to detect and analyze Next.js pages across different environments and domains

## Store Assets Checklist
- 128x128 extension icon
- Screenshots from popup
- Screenshots from dashboard/options page
- Optional promo tile / marquee assets if needed
