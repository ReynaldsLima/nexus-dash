# Features Research — NEXUS-DASH

**Domain:** Multi-tenant marketing analytics dashboard (Google Ads + Meta Ads, agency-focused)
**Researched:** 2026-05-10
**Confidence:** MEDIUM-HIGH (WebSearch + official docs cross-referenced)

---

## Table Stakes (Must Have or Users Leave)

Features users expect from any paid ads analytics platform. Absence causes churn or rejection during evaluation.

| Feature | Why Critical | Complexity | Notes |
|---------|--------------|------------|-------|
| Date range picker with presets | Every paid ads decision is time-scoped. Users expect "Last 7/14/30 days", "This month", "Last month", "Custom range" out of the box. Absence requires manual work every session. | Low | Presets cover 80%+ of use cases. Two-month side-by-side calendar for custom ranges is industry standard. |
| Period-over-period comparison | ROAS this week means nothing without last week. Every competitive platform shows delta % vs. prior period. Users are trained to expect it. | Low-Med | Show absolute value + delta + directional arrow (up/down/neutral). Color-code: green = positive, red = negative, accounting for whether metric polarity (lower CPA = good). |
| Cross-channel unified KPI view | Agencies manage Google Ads AND Meta simultaneously. Seeing them separately requires context-switching; unified view is the core value prop. | Med | Must normalize metric names: Google "Cost" = Meta "Amount Spent" = display "Spend". |
| ROAS, CPA, CTR, Spend, Impressions, Clicks, Conversions | These 7 metrics are non-negotiable for paid ads. Any dashboard missing one will be rejected by practitioners. | Low | See Metric Definitions section for exact formulas. |
| Campaign-level drill-down | KPI overview is entry point; campaign list is where decisions happen. Users need to attribute performance to specific campaigns without leaving the tool. | Med | Filterable by channel, date range, status (active/paused/ended). |
| Multi-account management | Agencies manage 2-50+ clients. Per-account login is a dealbreaker. Must show accounts as tenants with fast switching. | Med | Google Ads uses Manager Accounts (MCC). Meta uses Business Manager. Both must be reflected in the data model. |
| Data auto-sync (scheduled) | Manual refresh = tool gets ignored. Competitors sync every 1-4 hours; users expect data to be current when they open the dashboard. | Med-High | N8N scheduled workflows handle this for NEXUS-DASH. See Data Freshness section. |
| Metric trend visualization | Time-series chart for each KPI over the selected period. Users need to see if ROAS is improving or deteriorating, not just point-in-time value. | Med | Line charts are standard. Bar charts acceptable for spend. Avoid pie charts for time-series data. |
| Channel breakdown | Split Google Ads vs. Meta Ads contribution. Blended metrics hide allocation problems. | Low-Med | Side-by-side or stacked view. Percentage contribution and absolute values both needed. |
| Last sync timestamp | Users need to know how stale the data is. Missing timestamp = distrust. "Data as of 3 hours ago" is table stakes. | Low | Show per-tenant, per-channel. Critical for trust calibration. |

---

## Differentiators (Competitive Advantage)

Features that create meaningful separation from commodity reporting tools. Not expected, but valued — and in some cases, the primary reason users choose a platform over spreadsheets.

| Feature | Why Valuable | Complexity | Notes |
|---------|--------------|------------|-------|
| AI-generated campaign recommendations | Agencies spend hours analyzing data to formulate optimization hypotheses. On-demand AI analysis (with rationale) saves 2-4 hours/week per account. This is the stated core value of NEXUS-DASH. | High | Claude Sonnet 4-6 is the designated model. Recommendations need data context: last 7 days metrics, trend direction, benchmark comparison. Output: specific action + estimated impact + confidence. |
| Daily automated AI analysis (digest) | Proactive insight delivery vs. reactive querying. Users who don't remember to click "analyze" still get surfaced anomalies. Competitive with Databox's alerts + AI narrative. | High | N8N scheduled workflow triggers daily analysis. Saves to insights history. Super Admin only per PROJECT.md. |
| AI insights history / audit trail | Recommendations are only actionable if you can track whether you followed them and what happened. History with timestamps turns AI into a learning loop. | Med | Table of insights: date, channel, recommendation, type (budget/creative/audience/bid). Ability to mark as "acted on" is bonus. |
| Configurable retroactive data window | When a new client connects, being able to pull 90-180 days of history immediately (vs. only from connection date) is a significant onboarding advantage. Competitors often limit history. | Med | Configured per-tenant during onboarding. Bounded by API limits: Google Ads supports ~36 months, Meta Ads supports ~37 months via Insights API. |
| Anomaly alerting | Budget overspend, CPA spike, CTR crash — catching these within hours instead of days saves real money. Databox offers threshold alerts; AI-powered anomaly detection is differentiating. | Med-High | Start with threshold-based (spend > X, CPA > Y). Statistical anomaly detection (Z-score vs. 7-day rolling average) is a phase 2 capability. |
| Blended ROAS across channels | Platform-reported ROAS double-counts cross-channel touchpoints. True blended ROAS (total attributed revenue / total spend) is what Triple Whale and Northbeam charge for. Not available natively in Google or Meta dashboards. | High | Requires revenue data integration (e-commerce platform or manual input). May be out of scope for v1 given constraint on 1-3 clients. |
| Campaign status visibility (pacing) | Is a campaign on track to spend its budget this month? Pacing (current spend vs. expected spend by this date) is heavily requested by agencies. Missing from most generic analytics tools. | Med | Formula: expected spend = (daily budget * days elapsed). Pacing % = actual spend / expected spend. Flag over/under pacing. |
| Insight type tagging | Categorize recommendations: Budget Reallocation, Audience Expansion, Creative Fatigue, Bid Strategy, Negative Keywords. Helps agencies prioritize what to action first. | Low | Applied during AI output parsing or manually. Enables filtering the insights history. |

---

## Anti-Features (Deliberately Skip in V1)

Features that appear valuable but create disproportionate complexity, maintenance cost, or distract from core value. These are things NEXUS-DASH should explicitly not build in v1.

| Feature | Why Skip | Defer To |
|---------|----------|---------|
| White-label client portals | Agencies want to brand reports with their own logo/domain for client-facing delivery. This requires subdomain routing, custom email sending, and theme configuration per tenant. Complexity is high, v1 has 1-3 clients, all managed internally. | Phase 3+ or SaaS public launch |
| Self-service tenant onboarding | Registration flow, payment integration, email verification, client-created workspaces. Zero benefit when there are 1-3 manually managed clients. Adds auth complexity and billing infrastructure. | SaaS public launch phase |
| PDF / scheduled email report generation | Useful for agencies sending weekly reports to clients. Requires PDF rendering pipeline (Puppeteer/headless Chrome or a paid service), email delivery system, and template design. High complexity, low urgency for internal v1 use. | Phase 3 |
| Ad creative preview and scoring | Showing ad images/copy from the API and scoring them by CTR/ROAS is valuable (Triple Whale's creative analytics). But Meta Creative API access is rate-limited and requires special permissions. Scope creep risk is extreme. | Phase 4+ |
| Custom attribution modeling | First-touch, linear, time-decay, data-driven — custom attribution requires event-level data collection (pixel/server-side), probabilistic modeling, and significant data volume to be valid. Not feasible at 1-3 clients. | Post-SaaS with scale |
| Incrementality / A/B test measurement | Geo-holdout tests, conversion lift studies. Requires experimental design, large-enough user bases, and statistical expertise. Triple Whale and Northbeam charge enterprise prices for this. | Post-SaaS with scale |
| TikTok / LinkedIn / Pinterest integrations | Each platform has a separate API, auth flow, and data model. Scope explosion with minimal benefit at v1 scale. PROJECT.md explicitly excludes these. | Phase 3+ |
| Budget management / campaign editing | Writing changes back to Google Ads or Meta (pausing campaigns, changing bids, adjusting budgets) via API is high-stakes. One bug = real money impact for clients. Read-only analytics is safer for v1. | Phase 3+ after trust built |
| Natural language query interface | "Show me ROAS for last week by campaign" as a chat input. Interesting but not expected. Adds LLM prompt engineering complexity. Core AI value is recommendations, not query UX. | Phase 4+ |
| Real-time / live dashboard streaming | Sub-minute data updates via websockets. Google Ads SLO is 1-hour freshness for clicks/impressions; conversions lag 3-72 hours. "Real-time" is theater for this use case. 3-4 hour sync cycle is sufficient. | N/A — not valuable |
| Mobile-native app | Marketing analytics is a desktop-primary use case (B2B, weekday work-hours usage, complex data tables). Mobile web is sufficient for quick checks. Native app development is expensive overhead. | Never (responsive web is enough) |
| Automated budget allocation / bidding | AI automatically reallocating budget between campaigns. This is fully automated decision-making with financial consequences. Regulatory and trust risk far exceeds v1 value. | Never in v1 |
| Predictive forecasting | "Next 30-day ROAS projection." Requires significant historical data volume per account and statistical modeling. Unreliable at 1-3 clients with limited history. | Phase 4+ |
| CSV bulk import of offline conversions | Matching offline sales back to ad spend requires significant data pipeline work (hashing, matching, delay handling). Useful for some clients but not universally needed. | On-request |

---

## UX Patterns (Standard Conventions)

### Dashboard Layout

The industry standard layout for paid ads dashboards follows a three-tier hierarchy:

```
Tier 1: KPI Summary Cards (top row)
  - 4-6 metric cards: ROAS | CPA | Spend | Clicks | Impressions | CTR
  - Each card: current value + delta vs. comparison period + trend spark line

Tier 2: Channel Performance (middle section)
  - Side-by-side or tabbed: Google Ads / Meta Ads / Blended
  - Time-series chart with selectable metric (defaults to ROAS)

Tier 3: Campaign Table (bottom)
  - Sortable columns: Campaign Name | Channel | Status | Spend | ROAS | CPA | CTR | Clicks | Conversions
  - Filterable by: channel, status, date range
  - Row-level drill-down to ad set/ad group level (v2)
```

### Date Range Picker Conventions

- Default view on load: "Last 30 days"
- Comparison period: "Previous period" (auto-calculated, matching duration) OR "Same period last year"
- Quick presets: Today, Yesterday, Last 7 days, Last 14 days, Last 30 days, Last 90 days, This month, Last month, Custom range
- Two-month side-by-side calendar for custom ranges (industry standard)
- Date range should persist across page navigation within a session

### Metric Delta Display

- Green arrow up: positive for revenue metrics (ROAS, CTR, Conversions, Clicks, Impressions)
- Red arrow up: negative for cost metrics (CPA, Spend) — higher cost is bad
- Show both absolute delta and percentage: "+$1,250 (+18.3%)"
- Zero change: gray dash, no arrow

### Navigation Patterns

- Left sidebar (fixed): Overview, Campaigns, AI Insights, Settings
- Top bar: tenant/account switcher + date range picker (global, applies to all pages)
- No breadcrumbs needed at v1 depth (3-4 pages max)

### Empty States

- No data connected yet: clear CTA to connect Google Ads / Meta Ads accounts
- Sync in progress: skeleton loaders with "Syncing data..." messaging
- No campaigns in date range: "No campaigns ran in this period" (not a blank table)

### Mobile Considerations

B2B analytics is desktop-primary. Research shows desktop users account for 64% of B2B site visits during work hours (9am-5pm). Design for desktop first. Ensure:
- Summary KPI cards stack vertically on mobile
- Campaign table is horizontally scrollable on mobile (do not hide columns)
- Navigation collapses to hamburger menu
- No mobile-specific features needed in v1

---

## Metric Definitions

Standard formulas used across the industry. These must be implemented consistently to match what Google Ads and Meta Ads native interfaces show.

### Core Metrics

| Metric | Formula | Notes |
|--------|---------|-------|
| ROAS (Return on Ad Spend) | Revenue / Ad Spend | Ex: $4,000 revenue / $1,000 spend = 4.0x ROAS. Express as multiplier (4.0) or ratio (4:1). Industry healthy range: 3:1 to 5:1, varies by margin. |
| CPA (Cost Per Acquisition/Action) | Total Spend / Conversions | Ex: $1,000 / 50 conversions = $20 CPA. Lower is better. Target varies by product price and margin. |
| CTR (Click-Through Rate) | Clicks / Impressions | Ex: 500 clicks / 10,000 impressions = 5.0% CTR. Google Ads search average: 3-5%. Display: 0.1-0.5%. Meta: 0.5-2.0%. |
| CPM (Cost Per Mille) | (Spend / Impressions) * 1,000 | Ex: $50 / 10,000 impressions = $5 CPM. Useful for brand awareness campaigns. |
| CPC (Cost Per Click) | Spend / Clicks | Ex: $500 / 200 clicks = $2.50 CPC. |
| Conversion Rate | Conversions / Clicks | Ex: 50 conversions / 1,000 clicks = 5.0% CVR. |
| Blended ROAS | Total Revenue / Total Spend (all channels) | Deduplicates cross-channel attribution. Platform-reported ROAS sums exceed blended ROAS due to multi-touch credit. |

### Attribution Window Standards (as of 2026)

| Platform | Default Window | Notes |
|----------|---------------|-------|
| Google Ads | 30-day click, 1-day view | Data-driven attribution default. Last-click also common. Conversion data available within 3 hours for last-click; up to 15 hours for data-driven. |
| Meta Ads | 7-day click, 1-day view | 28-day view and 7-day view options were removed from the Ads Insights API in January 2026. This is a breaking change for tools relying on those windows. |

**Attribution window mismatch warning:** Google and Meta use different windows by default. Blended CPA comparisons across platforms are misleading without normalization. Display platform-specific numbers, flag that comparison requires caution.

### Calculated Metrics to Build

These are derived from raw API data and add significant value without complex infrastructure:

- **Blended Spend**: Google Ads Spend + Meta Ads Spend
- **Blended Impressions**: Sum across channels
- **Blended Clicks**: Sum across channels
- **Blended CTR**: Blended Clicks / Blended Impressions
- **Blended ROAS**: Total Revenue / Blended Spend (requires revenue data)
- **Period Delta %**: (Current - Prior) / Prior * 100

---

## Data Freshness Expectations

### Industry Standards

| Platform | Clicks/Impressions Freshness | Conversion Freshness | Competitive Metrics |
|----------|------------------------------|----------------------|---------------------|
| Google Ads | 1-hour SLO (Google's stated SLA) | 3 hours (last-click), up to 15 hours (data-driven attribution) | 24-72 hours (impression share, click share) |
| Meta Ads | 24-72 hours for conversions due to ATT and privacy modeling | 24-72 hours (privacy-preserving measurement adds delay) | N/A |

### Practical Sync Strategy for NEXUS-DASH

Given the latency characteristics:
- **Recommended sync frequency:** Every 3-4 hours for Google Ads, every 6 hours for Meta Ads
- **Daily full refresh:** Run at 2-4 AM to capture previous day's fully-settled data
- **Avoid claiming "real-time":** Marketing "real-time" means same-day, not same-minute. Most agency workflows operate on daily review cadence.
- **Conversion data caveat:** Display "Conversions may be incomplete for the last 72 hours" as a tooltip/footnote on conversion and CPA metrics.
- **Meta attribution lag note:** Only rely on conversion data that is at least 48 hours old for definitive analysis.

### What Agencies Accept

Based on competitive research, agencies using tools like AgencyAnalytics, Databox, and Supermetrics typically operate on:
- **Hourly refreshes:** For spend/impression monitoring (budget pacing checks)
- **Daily refreshes:** For conversion-based metrics and reporting
- **Weekly:** For trend analysis and AI recommendations

N8N scheduled sync at 3-4 hour intervals for core metrics and daily full refresh for conversions meets or exceeds agency expectations.

---

## Competitive Landscape Summary

| Platform | Primary Use Case | Key Differentiator | Relevance to NEXUS-DASH |
|----------|-----------------|-------------------|------------------------|
| Supermetrics | Data pipeline (ETL to Sheets/BigQuery/Looker) | 100+ connectors, AI reporting agents | Different category — we're a dashboard, not a pipeline |
| Databox | KPI dashboard with goal tracking | Pre-built templates, threshold alerts, mobile app | Closest comp for dashboard UX. Their alert patterns are worth copying. |
| AgencyAnalytics | Agency white-label reporting | White-label, 85+ connectors, client portals | Our target user (agency) but we skip white-label in v1 |
| Funnel.io | Marketing intelligence platform | 600+ connectors, MMM, incrementality | Enterprise tier. We're focused on paid ads only, much simpler. |
| Triple Whale | Ecommerce attribution (Shopify-specific) | Blended ROAS, creative analytics, profit tracking | Shopify-only. Different audience but AI recommendations pattern is relevant. |
| Northbeam | Multi-touch attribution engine | ML-based fractional attribution, creative LTV analysis | Very advanced, enterprise-grade. Too complex for v1 scope. |

**NEXUS-DASH's defensible position:** Simpler than Funnel/Northbeam, more AI-native than AgencyAnalytics/Databox, not locked to ecommerce like Triple Whale. The AI recommendation engine on top of a clean multi-tenant Google+Meta dashboard is the differentiating wedge.

---

## Sources

- [9 Best Centralized Marketing Analytics Dashboards 2026 — Cometly](https://www.cometly.com/post/centralized-marketing-analytics-dashboard)
- [10 Best Supermetrics Alternatives in 2026 — Porter Metrics](https://portermetrics.com/en/compare/supermetrics-alternatives/)
- [Triple Whale vs Northbeam 2026 — Head West Guide](https://www.headwestguide.com/triple-whale-vs-northbeam)
- [AgencyAnalytics Features — Official](https://agencyanalytics.com/features)
- [White Label Reports — AgencyAnalytics](https://agencyanalytics.com/features/white-label)
- [Funnel.io Review 2026 — Whatagraph](https://whatagraph.com/reviews/funnel-io)
- [Marketing Anomaly Detection and Alerts — Improvado](https://improvado.io/blog/marketing-anomaly-detection-automated-alerts)
- [Complete Guide to Meta Ads Monitoring for Agencies 2026 — Ads Anomaly Guard](https://adsanomalyguard.com/blog/meta-ads-monitoring-guide-agencies)
- [About Data Freshness — Google Ads Help](https://support.google.com/google-ads/answer/2544985?hl=en)
- [Meta Ads Attribution Window Removed January 2026 — Dataslayer](https://www.dataslayer.ai/blog/meta-ads-attribution-window-removed-january-2026)
- [Meta Ads Attribution Lag Explained — Five Nine Strategy](https://fiveninestrategy.com/meta-attribution-lag-explained/)
- [Return on Ad Spend Definitive Guide 2026 — Improvado](https://improvado.io/blog/return-on-ad-spend)
- [Marketing Dashboard Best Practices 2025 — Dataslayer](https://www.dataslayer.ai/blog/marketing-dashboard-best-practices-2025)
- [AI for Advertising 2026 — Improvado](https://improvado.io/blog/ai-for-advertising)
- [Multi-Account Management Guide 2026 — Sendwin](https://blog.send.win/how-digital-marketers-manage-multiple-client-accounts-efficiently-multi-account-management-guide-2026/)
- [Best PPC Reporting Tools 2026 — Whatagraph](https://whatagraph.com/blog/articles/ppc-reporting-tools)
- [Marketing KPI Benchmarks 2026 — 1ClickReport](https://www.1clickreport.com/blog/marketing-kpi-benchmarks-industry-2026)
- [Google Ads API v23.1 Changes — Digital Applied](https://www.digitalapplied.com/blog/google-ads-api-v23-management-april-2026-core-update)
- [Ads Insights API Metric Availability Updates — Meta Developers](https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/)
