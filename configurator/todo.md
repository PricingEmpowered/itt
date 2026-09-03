# ITT Connectors Product Configurator — TODO

## Database & Schema
- [x] Create products table (description, global_pn, regional_pn, stripped, series, line)
- [x] Create pricing_rules table (family, shell_size, contact_type, base_price, custom_upcharge_pct)
- [x] Create quote_requests table (session_id, items JSON, status, submitted_at, contact info)
- [x] Create quote_items table (quote_id, part_number, is_custom, attributes JSON, price, qty)
- [x] Seed products table from pasted_content.txt (111,396 rows via server-side script)
- [x] Seed pricing_rules with default values per family

## Backend (tRPC Routers)
- [x] configurator.getFamilies — return all 14 connector families
- [x] configurator.getAttributes(family) — return style/material/size/contact options
- [x] configurator.lookupPart(partNumber) — exact match in products table
- [x] configurator.searchParts(query) — fuzzy search
- [x] pricing.getPrice(family, attributes) — return base price or RFQ flag
- [x] quote.addItem / removeItem / getItems / updateQuantity / clear (session-based)
- [x] quote.submitRfq — save full quote request with attributes
- [x] admin.getPricingRules — owner-only
- [x] admin.updatePricingRule — owner-only
- [x] admin.getRfqSubmissions — owner-only
- [x] admin.updateRfqStatus — owner-only

## Frontend — Configurator
- [x] Family selector (top-level, styled cards)
- [x] Cascading attribute dropdowns (Style, Material, Size, Insert, Contact, Suffix)
- [x] Real-time part number builder display
- [x] Catalog lookup result panel (standard vs custom badge)
- [x] Product description, series, line display
- [x] Price display or RFQ flag
- [x] Add to Quote button
- [x] Decoded attribute breakdown panel

## Frontend — Quote Cart
- [x] Slide-out quote drawer (QuoteDrawer component)
- [x] Full quote page with line-item summaries
- [x] Qty controls (increment/decrement)
- [x] Remove item
- [x] Attribute breakdown expand/collapse per line item
- [x] RFQ submission form (name, company, email, phone, notes)
- [x] Submit quote → success confirmation screen

## Frontend — Admin Panel
- [x] Owner-only route guard (role check + unauthenticated redirect)
- [x] Pricing rules table with inline editing (base price, custom upcharge %, notes)
- [x] Quote requests list with status management (pending/reviewing/quoted/closed)
- [x] Quote detail view with full attribute breakdown per line item
- [x] Admin notes field per submission

## Design & Polish
- [x] Elegant light theme with ITT-inspired navy/slate color palette
- [x] Typography: Inter (body) + JetBrains Mono (part numbers)
- [x] Smooth transitions on dropdown cascades
- [x] Standard vs Custom visual distinction (badge, amber/green color coding)
- [x] Responsive layout
- [x] Loading skeletons and spinners
- [x] Empty states on all pages
- [x] Home landing page with stats, family cards, feature overview

## Tests
- [x] 35 Vitest tests covering: part number assembly (10), attribute data (6), decode (3), tRPC procedures (6), auth (1), admin access control (2), analytics (8)
- [x] All 35 tests passing

## Analytics Integration (ITT Pricing Intelligence Platform)

### Database & Schema
- [x] analytics_snapshots table (revenue, quotes, win_rate, customers by period/family/region/channel)
- [x] analytics_margin_bridge table (component, value, period)
- [x] analytics_products table (part_number, family, sales, margin_pct, price_premium, discount_pct, category)
- [x] analytics_quote_funnel table (period, stage, new_business, repeat_business)
- [x] analytics_price_waterfall table (component, value, period/filter combos)
- [x] Seed all analytics tables with 24 months of realistic ITT connector data

### Backend (tRPC analytics router)
- [x] analytics.getOverallPerformance(filters) — KPIs + price performance + margin bridge
- [x] analytics.getListPricePerformance(filters) — scatter data, pareto, discount analysis
- [x] analytics.getQuoteFunnel(filters) — KPIs, funnel stages, trends, segment table
- [x] analytics.getPriceWaterfall(filters) — waterfall components

### Frontend — Analytics Section
- [x] Analytics nav entry in TopNav
- [x] Analytics landing page with 4-tab navigation
- [x] Overall Business Performance: global filters, 4 KPI cards, Price Performance dual-axis chart, Margin Analysis waterfall chart
- [x] List Price Performance: family filter, Margin vs Sales scatter, Competitive Premium scatter (competitor dropdown), Pareto chart + category summary cards, Discount Analysis (stacked bar + scatter)
- [x] Quote Funnel Analysis: full filter set, 4 KPI cards, Funnel stacked bar chart, Quote Trends multi-line chart, Segment Comparison table
- [x] Price Waterfall Analysis: full filter set, 3 KPI summary cards, Price Waterfall chart (9-component), Component Detail table
- [x] All charts use Recharts with proper color coding (green=positive, red=negative, navy=totals)
- [x] All pages responsive and consistent with existing design system

## Analytics Filter Fix (Demo Quality)
- [x] Audit all DB query filter paths (region, channel, segment, period, family)
- [x] Reseed all analytics tables with full cross-product coverage (region × channel × segment × family × period)
- [x] Fix backend query logic so every filter combination returns data
- [x] Fix analytics_products to have data for every period shown in UI
- [x] Verify all 4 modules update correctly on every filter change

## Phase 5: Port 7 Pages from Existing Platform

### DB Schema & Seed
- [x] Add tables: customers, competitor_data, ai_model_stats, price_lists, price_list_items, quotes_mgmt, dynamic_pricing_scenarios
- [x] Seed customers (20 real enterprise ITT connector customers with real connector product categories)
- [x] Seed competitor data (5 competitors with market share, pricing, win/loss data)
- [x] Seed AI model stats and dynamic pricing scenarios
- [x] Seed price list data with AI recommendations
- [x] Seed quote management records

### Backend Routers
- [x] competitiveIntelligence router (market data, win/loss, positioning, recommendations)
- [x] dynamicPricing router (scenarios, optimization, elasticity, market conditions)
- [x] aiTools router (model stats, run optimization/forecast/analytics/anomaly)
- [x] customerManagement router (CRUD, search/filter, price index/margin)
- [x] productManagement router (standard + custom products, pricing formulas)
- [x] priceListManagement router (multi-tier lists, AI recommendations, approve/reject)
- [x] quoteManagement router (CRUD, status workflow, search/filter)

### UI Pages
- [x] Competitive Intelligence page (market table, win/loss, positioning, recommendations)
- [x] Dynamic Pricing page (strategy comparison, optimization results, elasticity, market conditions)
- [x] AI Tools page (4 model cards, 4 tabs, run actions)
- [x] Customer Management page (KPIs, customer cards with filters, View Details/Edit/Price Lists)
- [x] Product Management page (standard + custom tabs, product cards, pricing)
- [x] Price List Management page (multi-tier selector, table with AI recs, approve/reject workflow)
- [x] Quote Management page (table, status workflow, create/edit/preview)

### Navigation
- [x] Extend TopNav with Pricing and Management mega-menu dropdowns for all 7 new pages
- [x] Wire all routes in App.tsx
- [x] All pages accessible via dropdown menus

## Phase 6: Quote Creation Workflow
- [x] Extend DB schema: quoteWorkflow sessions, quoteWorkflowItems (type: existing/configured/custom)
- [x] Backend: getTargetPrice for Existing items (part# lookup + customer/deal attributes)
- [x] Backend: getTargetPrice for Configured items (assembled part# + customer pricing engine)
- [x] Backend: getTargetPrice for Custom items (complexity/MOQ/family upcharge rules)
- [x] Step 1 UI: Customer selector (search existing, pull master data) or Add New Customer inline
- [x] Step 2 UI: Line-item grid with item-type selector (Existing / Configured / Custom) per row
- [x] Existing item path: part number input → catalog lookup → target price recommendation panel
- [x] Configured item path: open configurator modal → assembled part# → target price panel
- [x] Custom item path: custom rules form → complexity/MOQ/family → target price panel
- [x] Wire quote workflow into top nav as primary CTA ("New Quote" button)
- [x] Route /quote-workflow added to App.tsx

## Phase 7: Three-Tier Price Recommendations in Quote Workflow
- [x] Extend computeTargetPrice backend to return three price tiers: Aggressive, Target, Conservative — each with win probability %
- [x] Win probability logic: Aggressive ~70-80%, Target ~50-60%, Conservative ~30-40% (adjusted by customer tier, deal type, urgency)
- [x] Update QuoteWorkflow UI: replace single target price with three selectable tier cards
- [x] Each tier card shows: tier name, price, discount from list, margin %, win probability bar
- [x] User clicks a tier card to select it as the quoted price (highlighted selection state)
- [x] List price always shown prominently at top of pricing panel
- [x] Selected tier price flows into line total and quote summary

## Phase 8: Configurator Modal in Quote Workflow (Configured Line Items)
- [x] Read existing Configurator page to understand the full configuration flow and state
- [x] Build ConfiguratorModal component: full-screen dialog wrapping the connector configurator steps
- [x] When line item type = "Configured" and user clicks the part number field, open ConfiguratorModal
- [x] ConfiguratorModal confirms selection → writes assembled part number back to the line item
- [x] After part number is written back, trigger pricing lookup automatically (pricingLoaded: true)
- [x] Show assembled part number as read-only with an "Edit" button to re-open modal

## Phase 9: Part Number Typeahead Autocomplete (Existing Line Items)
- [x] Add backend searchPartNumbers procedure: prefix/substring match on catalog part numbers, returns top 12 results with description, family, series
- [x] Debounced typeahead query in PartLookupPanel (only fires for "existing" item type, min 2 chars)
- [x] Dropdown list appears below the input showing matching part numbers with description and family badge
- [x] Clicking a suggestion fills the part number, auto-triggers lookup, and closes the dropdown
- [x] Keyboard navigation: arrow up/down to highlight, Enter to select, Escape to close
- [x] Show spinner in input while searching, "No matches" state when empty results

## Phase 10: Rebranding — Smart Target Pricing Engine
- [x] Update HTML title tag and meta description
- [x] Update TopNav logo tagline from "PRICING INTELLIGENCE" to "SMART PRICING ENGINE"
- [x] Update TopNav "Configure" nav link label to "Part Builder"
- [x] Rewrite Home.tsx hero headline, subheadline, CTA copy, FEATURES array, STATS, and footer
- [x] Update Home.tsx CTA section and footer brand text
- [x] Update QuoteCart.tsx "Back to Configurator" / "Configure Another Part" labels
- [x] Update Configurator.tsx page header and breadcrumb to "Part Builder"

## Phase 11: 5-Level Quote Approval Workflow
- [x] DB schema: quote_approvals table (quoteId, level 1-5, approverRole, status, actedBy, actedAt, comments)
- [x] DB schema: approval_levels seed data (Level 1: Sales Rep, Level 2: Sales Manager, Level 3: Regional Director, Level 4: VP Sales, Level 5: CFO/Executive)
- [x] Backend: submitForApproval — creates approval chain records for all 5 levels, sets quote status to "Pending Approval"
- [x] Backend: getApprovalQueue — returns quotes pending action at a given level for the current user
- [x] Backend: approveLevel — marks current level approved, advances to next level (or marks quote Approved if level 5)
- [x] Backend: rejectLevel — marks level rejected, returns quote to submitter with comments
- [x] Backend: escalateLevel — bumps to next level early with reason
- [x] Backend: delegateLevel — reassigns a level to another approver
- [x] Backend: getApprovalHistory — full audit trail for a quote
- [x] UI: Approval Queue page — list of quotes pending action at each level, filterable by level/status/customer
- [x] UI: Quote Approval Detail page — full quote summary, line items, pricing tiers, approval chain progress bar
- [x] UI: Approve/Reject/Escalate/Delegate action panel with comments field
- [x] UI: Approval chain timeline — visual stepper showing all 5 levels with status badges
- [x] Wire quote workflow submission to trigger approval chain
- [x] Show approval status badge on Quote Management table rows
- [x] Add Approval Queue to navigation

## Phase 12: Role-Aware Workflow Landing Dashboard
- [x] Replace Home.tsx with a post-login workflow launcher showing 6 primary workflow cards
- [x] Workflow cards: Quote (+ New Quote), Approve (pending count), Analyze (Pricing Intelligence), AI Insights (run models), Dashboard (overview KPIs), Part Builder
- [x] Each card: icon, title, description, live status/count badge, primary CTA button
- [x] Guest/unauthenticated state: show branded sign-in prompt instead of workflow cards
- [x] Live counts: pending approvals, open quotes, AI model status
- [x] Quick-action strip at top: "+ New Quote", "My Approvals", "Run AI Analysis"
- [x] Greeting with user name and current date/time
- [x] Keep the existing marketing hero accessible via a separate route for unauthenticated visitors

## Phase 13: Quote Detail in Approval Queue
- [x] Add getQuoteDetail backend procedure: returns workflow header, all line items with pricing, and approval chain
- [x] Quote detail panel: customer info card (name, tier, region, channel, contact, deal type, urgency)
- [x] Quote detail panel: line items table (part number, description, family, qty, list price, quoted price, discount %, line total)
- [x] Quote detail panel: pricing summary (total list value, total quoted value, avg discount, target margin)
- [x] Quote detail panel: 3-tab layout (Quote Overview / Line Items / Approval Chain)
- [x] Action buttons (Approve/Reject/Escalate/Delegate) remain below the detail panel

## Phase 14: Custom Item Cost Input
- [x] Add customCost column to quote_workflow_items schema (decimal, nullable)
- [x] Generate and apply migration SQL for the new column
- [x] Update computeTargetPrice to accept customCost param; use it to compute real GM% for each tier instead of estimated cost
- [x] Add "Estimated Cost" input field to CustomItemPanel (currency input, with $ prefix and helper text)
- [x] Gross margin % per tier card computed from entered cost (real cost-based margin vs estimated)
- [x] Store customCost in the line item when saved (via upsertItem and submit handler)

## Phase 15: Quote Intelligence Panel
- [x] Backend: getQuoteIntelligence procedure — accepts customerTier, channel, family, avgDiscount; returns win probability, peer comps, scatter data
- [x] Win probability: segment win rate + discount delta + tier/deal/urgency adjustments (15–92% range)
- [x] Peer comps: 3 closest historical deals by discount proximity for same customer tier + product family, with volume and won/lost outcome
- [x] Scatter data: 40 historical deal points (discount %, volume, won/lost) for the same customer tier + family segment
- [x] UI: Quote Intelligence panel in Step 2 — win probability gauge with color-coded bar, benchmark stats, peer comps table, scatter plot (Recharts)
- [x] Scatter plot: won (green) / lost (red) historical cloud + current quote (navy, larger dot) + avg discount reference line
- [x] Panel updates reactively as line items are added/changed (re-queries on totalDiscount/totalQuoted change)

## Phase 16: Embed Part Builder in Quote — Remove from Nav
- [x] Remove "Part Builder" link from TopNav coreLinks (no longer in desktop or mobile nav)
- [x] Remove "Part Builder" card from Home page WORKFLOW_CARDS array
- [x] Remove unused Settings icon import from Home.tsx
- [x] /configure route still exists in App.tsx for ConfiguratorModal internal use; no direct nav entry

## Phase 17: Quote Expiry, Customer Agreements, Audit Log, Compliance, Margin Causality

### DB Schema
- [x] Add effectiveDate, expirationDate, validityDays to quote_workflows table
- [x] Create customer_agreements table (customer, product family, floor/target/ceiling price, start/end date, status)
- [x] Create price_change_audit table (entity type, entity id, field, old value, new value, changed by, changed at, reason)
- [x] Create channel_compliance table (customer, channel, part, quoted price, authorised floor, authorised ceiling, compliant, quote date)

### Backend Procedures
- [x] quoteWorkflow: add effectiveDate/expirationDate to create/update procedures
- [x] quoteWorkflow: getExpiringQuotes — returns quotes expiring in next N days
- [x] agreements: CRUD procedures for customer pricing agreements
- [x] agreements: checkAgreementPrice — given customer + part, returns active agreement price if one exists
- [x] priceList: logPriceChange — called on every price list update to write to audit table
- [x] priceList: getAuditLog — returns paginated audit log for a price list or product
- [x] compliance: getComplianceReport — returns out-of-band quotes per channel/customer
- [x] analytics: getMarginCausality — flags families/customers with win rate drops, revenue drops, and low price index

### UI Pages
- [x] Home page: add "Expiring Quotes" queue card showing quotes expiring in next 10 days
- [x] Customer Agreements page: list, create, edit agreements with status badges and expandable detail
- [x] Price List Management: add Audit Log tab showing price change history with entity type filter
- [x] Channel Compliance page: KPI bar, channel breakdown, out-of-band quotes table with violation types
- [x] Margin Causality page (under Pricing): flagged items with signal type, severity, and period-over-period change

### Navigation
- [x] Add Customer Agreements to Management dropdown
- [x] Add Channel Compliance to Management dropdown
- [x] Add Margin Causality to Pricing dropdown

### Wiring Gaps (Phase 17 follow-up)
- [x] Wire Effective Date and Expiration Date fields into QuoteWorkflow Step 1 UI and persist through main create/update mutations
- [x] Integrate logPriceChange into price list approve/reject mutations so audit entries are created automatically

## Phase 18: Growth Opportunity Flags in Margin Causality
- [x] Backend: add three growth signal types: win_rate_surge, volume_growth, price_power
- [x] Backend: add direction field ("risk" | "opportunity") to MarginCausalityFlag
- [x] UI: opportunity flags shown in distinct emerald/teal section below risk flags
- [x] UI: KPI bar shows Risk Flags count + Opportunities count + Families Flagged
- [x] UI: signal legend chips for both risk and opportunity types
- [x] UI: explainer updated to describe both risk and opportunity detection
- [x] Sort: risks first (by severity), then opportunities (by severity)

## Phase 19: Pricing Rules Engine (5 Rule Types + Priority)

### DB Schema
- [x] Create pricing_rules table: id, name, ruleType (min_margin|min_markup|family_tether|competitor_tie|max_discount_segment), scope (family|channel|customerTier|global), scopeValue, paramValue (decimal), competitorName (nullable), priority (int), active, createdAt

### Backend
- [x] Add getPricingRules, createPricingRule, updatePricingRule, deletePricingRule, reorderPricingRules procedures
- [x] Integrate all 5 rule types into computeTargetPrice — load active rules sorted by priority, apply in order, track which rules fired
- [x] min_margin: floor = cost / (1 - minMarginPct); raise any tier price below floor
- [x] min_markup: floor = cost * (1 + markupPct); raise any tier price below floor
- [x] family_tether: anchor = family average list * tether ratio; adjust tier prices toward anchor
- [x] competitor_tie: floor/ceiling = competitor price * (1 + premiumPct); adjust tiers to stay within band
- [x] max_discount_segment: cap discount at maxDiscountPct for matching customerTier/channel
- [x] Return appliedRules[] in TargetPriceResult

### UI
- [x] Pricing Rules page: rule list sorted by priority with up/down reorder arrows, rule type badge, scope badge, active toggle
- [x] Add/Edit rule form: rule type selector drives dynamic fields
- [x] Add Pricing Rules to Pricing dropdown in TopNav
- [x] Quote workflow: show "Rules Applied" badge on pricing panel listing which rules fired

## Phase 20: Bulk Quote Opportunities, Bulk Review, and Deal Scoring
- [x] Define bulk-upload file template and import validation rules for large product opportunities
- [x] Add opportunity header and imported-line-item schema with import status, bulk-decision state, and per-line exception rationale
- [x] Add structured deal-intake questionnaire: OEM/Distributor, customer-spec alignment, targets, competitive/sole-source status, quote and booking history, POS support, distributor resale margin, and projected cost at volume
- [x] Build quote-history and booking-history evidence fields with recent-quote dates, prior booked value, expected bookings, and decision evidence
- [x] Build POS and distributor-resale validation fields, including support status and distributor/ITT margin comparison
- [x] Build cost-validation fields for projected cost at quoted volume and use supplied cost data in margin calculations
- [x] Build bulk import parser with row-level validation, duplicate detection, workbook-tab enrichment, and error-download feedback
- [x] Compute target/list/floor prices and win probability for all uploaded lines in a single bulk-pricing operation
- [x] Compute overall deal score from opportunity context, pricing compliance, margin quality, competitive position, history, POS validation, and cost validation
- [x] Build Bulk Opportunity intake page with file upload, column guidance, and questionnaire
- [x] Build bulk review grid with filters, selection controls, target prices, exception flagging, and editable decision fields
- [x] Add Select All, Bulk Approve Target, Bulk Set Tier, and Bulk Flag Exception actions with a selected-count indicator
- [x] Add per-line exception panel requiring price, business justification, and exception owner
- [x] Add overall deal-score panel with score drivers, confidence, and approval recommendation
- [x] Submit fully decided bulk opportunity lines to the existing quote approval workflow and preserve individual exceptions
- [x] Seed a 60-line Collins historical SPA demo opportunity from the supplied workbook with mixed target/exception lines
- [x] Add Vitest coverage for bulk import and decision input validation

### SPA Reference-Format Support
- [x] Analyze Collins Cornelius Worksheet (.xlsb), SPA Extract (.xlsx), and SPA Items Parts View (.xlsx) field structures
- [x] Support guided mapping for minimal files containing Requested Part No. and Qty only
- [x] Auto-detect and import known SPA Extract / Parts View fields when available
- [x] Preserve available mapped source values and import provenance for detailed work-up review

## Phase 21: SPA Detail Work-Up Review Grid
- [x] Map the expected SPA core columns: part identity, annual usage, duplicate status, line/product classification, and customer specification references
- [x] Capture cost-year/status, annual/forward/estimated costs, MOQ, package quantity, and lead-time fields from the supplied SPA worksheet
- [x] Capture current LTA, bid floor, target, negotiation-price, award-price, and margin comparison fields where supplied
- [x] Capture available year-over-year booking/global-booking fields and historical-price references
- [x] Redesign bulk review into compact SPA Detail and Price Decision views, retaining bulk selection and exception governance
- [x] Add grouped SPA views so the full detail is accessible without an unusable 150-column decision table
- [x] Validate the grid against the supplied Collins sample rows and retain the current bulk approval workflow

### Source-Aware Field Ownership
- [x] Mark item-master enrichments distinctly: product identity, classification, cost, MOQ, package quantity, lead time, and list price
- [x] Mark sales-data enrichments distinctly: LTA, booking history, quote history, award history, channel/POS support, and repeat-volume indicators
- [x] Keep commercial assumptions as guided user inputs: customer-spec position, competitive status, targets, current competitor position, projected volume cost, and exception rationale
- [x] Show field-source status and missing-data prompts so user entry is requested only where system enrichment is unavailable

## Phase 22: SPA Upload Header Detection Fix
- [x] Reproduce the low recognized-field count across the supplied SPA workbooks and sheets
- [x] Expand canonical header aliases to cover the SPA Extract, Parts View, Bid Worksheet, and common abbreviations
- [x] Improve header-row scoring so detailed worksheets are selected ahead of high-volume supporting POS/history tabs
- [x] Show recognized-field diagnostics and mapped-field counts in the upload worksheet selector
- [x] Add regression tests for header parsing and validate the supplied formats before release

## Phase 23: Bulk Line Override and Detail Workspace
- [x] Add a governed line-level target override with proposed price, rationale, and accountable owner
- [x] Preserve original engine target and display override variance, floor compliance, margin, and win probability
- [x] Add a full line-detail workspace from the bulk review using the one-line quote pricing experience
- [x] Reuse three-tier pricing, applied rules, customer/deal context, competitor context, and quote intelligence on the selected bulk line
- [x] Return the user to the bulk grid with the revised line decision saved and visible
- [x] Add regression tests for the new override action and validate bulk approval submission retains overrides with their rationale

## Phase 24: Direct Bulk Line Drill-In and Quote Intelligence
- [x] Add a visible line-level drill-in shortcut to every pricing-grid row (double-click) and retain the single-select Review action
- [x] Add the same closest-peer-deals view used by single-line quotes to the bulk line workspace
- [x] Add the same historical discount-versus-volume scatter plot, including the current line marker and benchmark reference
- [x] Ensure peer and scatter data updates with the selected line’s family, customer tier, channel, quantity, and proposed price
- [x] Validate the direct drill-in experience, type check, and regression suite

## Phase 25: Guided Bulk Exception Approval Submission
- [x] Add a prominent approval-readiness banner to the bulk review that distinguishes target decisions, exceptions, and remaining unresolved lines
- [x] Explain the approval path, next approver level, exception count, and governed-decision count before submission
- [x] Change the final CTA to a clear “Review X exceptions for approval” action when the opportunity is ready
- [x] Add an in-page confirmation handoff summarizing quote value, exception impact, and five-level approval routing
- [x] Add clear blocked-state guidance when pending or invalid lines prevent submission
- [x] Test the guided submission states with the Collins SPA demo and retain the existing approval-chain behavior

## Phase 26: Pilot AI Functionality Removal
- [x] Remove the AI Pricing Insights card and Run AI Analysis quick action from the landing dashboard
- [x] Remove AI Tools and Dynamic Pricing navigation entries and routes from the pilot UI
- [x] Remove AI model counts and AI-model language from visible dashboard metrics and copy
- [x] Retain non-AI pricing, analytics, competitive intelligence, approval, and bulk opportunity functions
- [x] Document on-premises LLM security as the prerequisite for any future AI capability reintroduction

## Phase 27: English-Only Content Audit
- [x] Scan all client/server source and seed scripts for Chinese and other unintended non-English characters
- [x] Audit all user-facing database text, prioritizing approval queue records and quote line-item descriptions
- [x] Replace the only two detected Chinese source comments with English; no Chinese data values were found in the audited user-facing tables
- [x] Verify approval queue, quote management, bulk opportunity review, and core dashboards render English-only text
- [x] Add an automated regression scan and checkpoint the corrected pilot

## Phase 28: Bulk Upload Template
- [x] Define an Excel template with Requested Part No. and Qty as required columns plus optional importer-recognized enrichment fields
- [x] Add an Instructions worksheet explaining field purpose, required status, expected format, and supported aliases
- [x] Add annotated example opportunity lines that can be deleted before upload
- [x] Add a Download Template control to the Bulk Opportunity import panel
- [x] Verify the generated workbook imports successfully and add regression coverage
