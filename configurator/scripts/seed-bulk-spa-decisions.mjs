import {
  applyBulkOpportunityAction,
  getBulkOpportunityItems,
  listBulkQuoteOpportunities,
  setBulkOpportunityException,
} from "../server/bulkOpportunityDb.ts";

const DEMO_NAME = "Collins Cornelius Historic SPA — Imported Review";
const opportunities = await listBulkQuoteOpportunities();
const opportunity = opportunities.find((candidate) => candidate.name === DEMO_NAME);

if (!opportunity) {
  console.error("Run seed-bulk-spa-demo.mjs before adding demo decisions.");
  process.exit(1);
}

const items = await getBulkOpportunityItems(opportunity.opportunityToken);
const pending = items.filter((item) => item.reviewStatus === "pending");
if (pending.length) {
  const approvals = pending.slice(0, Math.max(0, pending.length - 4));
  if (approvals.length) {
    await applyBulkOpportunityAction({
      opportunityToken: opportunity.opportunityToken,
      itemIds: approvals.map((item) => item.id),
      action: "approve_target",
      actedBy: "Demo Pricing Analyst",
    });
  }
  for (const [index, item] of pending.slice(-4).entries()) {
    const proposed = Number(item.proposedPrice ?? item.targetPrice ?? 0);
    await setBulkOpportunityException({
      opportunityToken: opportunity.opportunityToken,
      itemId: item.id,
      exceptionPrice: Number((proposed * (index % 2 === 0 ? 0.94 : 1.03)).toFixed(2)),
      exceptionReason: index % 2 === 0
        ? "Historic SPA position requires price alignment on this customer-specified line."
        : "Cost and lead-time risk require a protected margin position on this line.",
      exceptionOwner: index % 2 === 0 ? "Regional Sales Director" : "Product Line Manager",
      actedBy: "Demo Pricing Analyst",
    });
  }
}

const reviewed = await getBulkOpportunityItems(opportunity.opportunityToken);
console.log(JSON.stringify({
  opportunityToken: opportunity.opportunityToken,
  approvedTarget: reviewed.filter((item) => item.reviewStatus === "approved_target").length,
  exceptions: reviewed.filter((item) => item.reviewStatus === "exception").length,
  pending: reviewed.filter((item) => item.reviewStatus === "pending").length,
}, null, 2));
process.exit(0);
