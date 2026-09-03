# Visual Verification Notes

- The direct bulk-line workspace displays the three-tier price recommendations, closest historical peer price points, and the discount-versus-volume scatter plot with won, lost, and current-line markers.
- The bulk opportunity intake and review route loads correctly in the authenticated preview. The approval handoff is rendered below the intake section once a saved opportunity is loaded for review.

## 2026-08-28 — English-only content audit

- Source scan found two Chinese-language comments in `client/src/hooks/useComposition.ts`; both were translated to English. A follow-up scan found no Chinese, Japanese, or Korean characters in app source, server source, shared modules, seed scripts, or migrations.
- Read-only database checks found no Chinese characters in approval workflow headers, quote workflow line items, quote management records, imported SPA review lines, or the product catalog.
- Visual checks of Home, Approval Queue, Quote Management, Bulk Opportunities, Analytics, Competitive Intelligence, Channel Compliance, and Margin Causality displayed English-only user-facing text. The approval queue did reveal one malformed user-created customer name, `corn`, in workflow `WF-fj6LuV3JWRJ8`; this is English text, not Chinese, and is unrelated to the character audit.
