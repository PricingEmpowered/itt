# PriceSpace CPQ Demo Script

## Overview
This demo showcases a complete Configure-Price-Quote (CPQ) system with advanced pricing intelligence, deal scoring, commission management, and price optimization features.

---

## Setup & Login

### Before You Start
- **URL**: Access your deployed application
- **Login**: Use your authenticated email/password
- **Demo Duration**: 15-20 minutes for full walkthrough

---

## Demo Flow (20 Minutes)

### 1. Dashboard Overview (2 min)
**Click**: Dashboard (home icon)

**What to Show**:
- **Quote Activity**: 3,815+ quotes in the system
- **Deal Score Health**: Average deal score around 85-90
- **Recent Activity**: Historical quotes with various statuses
- **Commission Overview**: Total commissions tracked
- **Top Products**: Best-selling items by revenue

**Key Points**:
- "This is command central for sales operations"
- "Real-time visibility into quote pipeline and performance"
- "Notice the deal scoring - we'll dive into that shortly"

---

### 2. Product Catalog (2 min)
**Click**: Products (package icon)

**What to Show**:
- Browse 1,045+ products across categories:
  - Actuators, Bearings, Controls, Electrical, Fasteners, etc.
- **Filter by category**: Try "Controls" or "Bearings"
- **Search**: Search for "Actuator" or "Bearing"
- Product details showing:
  - Base cost
  - List price
  - Default margin %
  - Status (Active/Inactive)

**Key Points**:
- "Complete product hierarchy with real-time pricing"
- "Each product has cost and price tracking for margin analysis"
- "Products organized by industrial equipment categories"

**Demo Data Verified**: ✅ 1,045 active products seeded

---

### 3. Customer Management (1 min)
**Click**: Customers (users icon)

**What to Show**:
- 500+ customers across segments:
  - Enterprise, Mid-Market, Small Business
- Customer attributes:
  - Annual revenue
  - Location
  - Industry
  - Payment terms
- Quick stats by segment

**Key Points**:
- "Customer segmentation drives pricing strategy"
- "Different price lists can be assigned by segment"
- "Annual revenue visible for context"

**Demo Data Verified**: ✅ 500 customers with varied segments

---

### 4. Price Lists & Quantity Breaks (3 min)

#### Price Lists
**Click**: Price Lists (dollar sign icon)

**What to Show**:
- Multiple price lists:
  - **Master Price List** (baseline)
  - **Regional Lists**: North America, Europe, Asia Pacific
  - **Segment Lists**: Enterprise, Mid-Market, Small Business
- View any price list to see product-specific pricing
- Show how different customers get different prices

**Key Points**:
- "Flexible pricing strategy with multiple lists"
- "Regional pricing accounts for market differences"
- "Segment-based pricing rewards volume customers"

#### Quantity Breaks
**Click**: Quantity Breaks (layers icon)

**What to Show**:
- Volume discount structures:
  - Buy 10-49 units: 5% off
  - Buy 50-99 units: 8% off
  - Buy 100-249 units: 12% off
  - Buy 250+ units: 15% off
- Applied across different product categories
- Configurable thresholds

**Key Points**:
- "Automated volume discounting encourages larger orders"
- "Discounts stack with base pricing"
- "Sales reps see recommendations in real-time"

**Demo Data Verified**: ✅ Multiple price lists and quantity breaks configured

---

### 5. Quote Builder - Create a Quote (4 min)
**Click**: Create Quote (file text icon)

**Step-by-Step Demo**:

1. **Select Customer**: Pick "Tech Innovations Inc" or any Enterprise customer
2. **Select Price List**: Choose "Enterprise Customers"
3. **Select Currency**: Choose "USD" (or try EUR to show multi-currency)
4. **Add Products**:
   - Search for "Actuator" - add 25 units
   - Search for "Bearing" - add 50 units
   - Search for "Control" - add 15 units
5. **Watch Real-Time Calculations**:
   - Line totals calculate automatically
   - Quantity break discounts apply
   - Deal score calculates in real-time (aim for 70+)
6. **Add Services** (optional):
   - Click "Services" tab
   - Add "Premium Support" - 12 month contract
   - Show recurring revenue calculation
7. **Review Totals**:
   - Subtotal, tax (10%), grand total
   - **Deal Score displayed** (should be 70-100)
8. **Save Quote**
   - Click "Save Quote"
   - Note the quote ID generated

**Key Points**:
- "Guided selling with real-time guidance"
- "Deal score prevents low-margin deals"
- "Multi-currency support for global operations"
- "Services add recurring revenue streams"
- "Commission automatically calculated on save"

**Demo Data Verified**: ✅ Products, customers, price lists, services ready

---

### 6. Deal Score Intelligence (3 min)
**Click**: Deal Score Analytics (bar chart icon)

**What to Show**:
- **Overall Performance Metrics**:
  - Average deal score across all quotes
  - Distribution of scores (how many high vs low)
  - Win rate correlation with deal score
- **Score Components**:
  - Margin health (30% weight)
  - Competitive positioning (25% weight)
  - Deal velocity (20% weight)
  - Customer fit (15% weight)
  - Discount discipline (10% weight)
- **Trends Over Time**:
  - Monthly score trends
  - Improving or declining
- **Product Performance**:
  - Which products score highest
  - Which need pricing optimization

**Key Points**:
- "Deal score predicts win probability"
- "Scores above 70 qualify for commission bonus"
- "Data-driven insights prevent margin erosion"
- "Real-time feedback guides better pricing decisions"

**Demo Data Verified**: ✅ 3,815 quotes with deal scores

---

### 7. Price Alerts & Cost Management (2 min)
**Click**: Price Alerts (bell icon)

**What to Show**:
- **8 Active Cost Change Alerts**:
  - Supplier price increases expected
  - Urgency levels: Critical (red), High (orange), Medium (yellow)
  - Days until effective date
  - Current cost vs expected new cost
  - Recommended price adjustments

**Demonstrate Bulk Update**:
1. **Select Multiple Alerts**: Check 3-4 alerts
2. **Click "Update X Selected"**
3. **Choose Strategy**:
   - **Use Recommended Prices**: Maintains 30% target margin
   - **Maintain Current Margin %**: Keeps same percentage
   - **Maintain Current Margin $**: Keeps same dollar profit
4. **Review Impact**: See what will change
5. **Confirm Update**: Updates master price list

**Key Points**:
- "Proactive cost management prevents margin squeeze"
- "Multiple strategies for different business priorities"
- "Bulk operations save time on large catalogs"
- "Audit trail tracks all price changes"

**Demo Data Verified**: ✅ 8 cost alerts seeded with various urgency levels

---

### 8. Commission Management (3 min)
**Click**: Commissions (percent icon)

**What to Show**:

#### Summary Stats (Top Cards)
- **Total Commissions**: $257,805
- **Won (Unpaid)**: $14,680 owed to reps
- **Paid**: $59,065 historical
- **Avg Deal Score**: 95

#### All Commissions Tab
- **30 commission records** with:
  - Quote ID linking back to deal
  - Sales rep email
  - Deal size and deal score
  - Commission breakdown:
    - Base % (3-6% based on deal size tier)
    - Bonus % (0.5-2% if deal score ≥70)
    - Total % and dollar amount
  - Status: Pending/Won/Paid

**Filter Demonstration**:
- Filter by status: Show only "Pending"
- Filter by rep: Pick a specific sales rep

**Status Changes**:
1. Find a "Pending" commission
2. Click "Mark Won" - moves to "Won" status
3. Click "Mark Paid" - moves to "Paid" status

#### By Sales Rep Tab
- Performance summary showing:
  - Total deals per rep
  - Won deals and revenue
  - Commission owed vs paid
  - Average deal score by rep

**Key Points**:
- "Commission structure based on deal size AND quality"
- "4 tiers: Small (3%), Standard (4%), Large (5%), Enterprise (6%)"
- "Deal score bonus (0.5-2%) rewards high-quality deals"
- "Automatic calculation on every quote"
- "Incentivizes reps to maintain good margins"

**Demo Data Verified**: ✅ 30 commissions across all statuses and tiers

---

### 9. Price Simulation (2 min)
**Click**: Price Simulation (trending up icon)

**What to Show**:
1. **Create New Scenario**:
   - Name: "Q4 2025 Pricing Strategy"
   - Description: "Testing 5% across-the-board increase"
2. **Select Products**: Choose 5-10 products
3. **Apply Adjustments**:
   - Try +5% increase
   - Or segment-based: +3% for high-margin, +7% for low-margin
4. **View Impact**:
   - Revenue impact projection
   - Margin improvement
   - Competitive positioning change
5. **Compare Scenarios**: Create multiple "what-if" analyses

**Key Points**:
- "Test pricing strategies without risk"
- "Model revenue and margin impact"
- "Data-driven pricing decisions"
- "Compare multiple scenarios side-by-side"

**Demo Data Verified**: ✅ Products available for simulation

---

### 10. Approvals Workflow (1 min)
**Click**: Approvals (checkmark icon)

**What to Show**:
- Quotes awaiting approval
- Approval criteria:
  - Low margin requires manager approval
  - Large deal size requires VP approval
- Approval history and audit trail
- One-click approve/reject

**Key Points**:
- "Built-in governance for pricing exceptions"
- "Escalation rules protect margins"
- "Complete audit trail for compliance"

---

### 11. Services & SLA Management (1 min)
**Click**: Services (headphones icon)

**What to Show**:
- Service offerings:
  - Basic Support
  - Premium Support
  - White Glove Support
- SLA definitions:
  - Response times
  - Resolution times
  - Availability guarantees
- Pricing by service tier
- Contract terms (monthly, annual)

**Key Points**:
- "Add recurring revenue to product quotes"
- "SLA-backed service commitments"
- "Flexible billing periods"

**Demo Data Verified**: ✅ Services and SLAs configured

---

## Key Value Propositions

### For Sales Teams
✅ **Faster Quoting**: Create quotes in minutes, not hours
✅ **Guided Selling**: Real-time deal score prevents bad deals
✅ **Automated Discounting**: Quantity breaks apply automatically
✅ **Multi-Currency**: Quote in 20+ currencies
✅ **Mobile Ready**: Access anywhere

### For Sales Management
✅ **Deal Intelligence**: Predict win probability with deal scores
✅ **Commission Automation**: Eliminate spreadsheet errors
✅ **Performance Analytics**: Rep-level insights
✅ **Approval Workflows**: Enforce pricing discipline
✅ **Pipeline Visibility**: Real-time dashboard

### For Finance/Pricing Teams
✅ **Margin Protection**: Deal scores prevent erosion
✅ **Cost Management**: Proactive alerts on cost changes
✅ **Price Optimization**: Simulation tools for strategy
✅ **Flexible Pricing**: Multiple price lists and rules
✅ **Audit Trail**: Complete change history

### For Leadership
✅ **Revenue Intelligence**: Data-driven insights
✅ **Profitability**: Automated margin management
✅ **Scalability**: Handle thousands of products/customers
✅ **Global Ready**: Multi-currency, multi-region
✅ **Integration Ready**: API-first architecture

---

## Common Demo Scenarios

### Scenario 1: "Show me a high-value enterprise deal"
1. Go to Create Quote
2. Select Enterprise customer
3. Add multiple high-value products (Actuators, Controls)
4. Add Premium Support service
5. Show deal score calculation (should be 80+)
6. Save and show commission calculation (6-8%)

### Scenario 2: "How do you prevent low-margin deals?"
1. Go to Deal Score Analytics
2. Show score components and margin weight
3. Create a quote with heavy discounts
4. Show deal score drops below 70
5. Explain approval workflow kicks in

### Scenario 3: "What happens when costs increase?"
1. Go to Price Alerts
2. Show pending cost change alert
3. Select alert and click Update
4. Show three pricing strategies
5. Execute bulk update
6. Show impact on margins

### Scenario 4: "How do commissions work?"
1. Go to Commissions
2. Show commission tier structure
3. Find example: $200k deal, score 85
4. Explain: 6% base + 2% bonus = 8% = $16k commission
5. Compare to same deal with score 65: only 6% = $12k
6. Show this incentivizes better pricing discipline

---

## Technical Highlights

- **Built on Supabase**: PostgreSQL database with real-time capabilities
- **React + TypeScript**: Modern, type-safe frontend
- **Row Level Security**: Enterprise-grade data security
- **Real-time Calculations**: Instant feedback on every change
- **Scalable Architecture**: Handles enterprise workloads
- **Multi-tenant Ready**: Isolate data by organization

---

## Next Steps After Demo

1. **Discovery Questions**:
   - "How many products do you currently manage?"
   - "What's your average quote turnaround time?"
   - "How do you handle pricing approvals today?"
   - "Do you have regional pricing needs?"

2. **Customization Discussion**:
   - Custom approval workflows
   - Integration with CRM/ERP
   - Custom deal score algorithms
   - Industry-specific features

3. **Implementation Timeline**:
   - Phase 1: Core CPQ (4-6 weeks)
   - Phase 2: Deal Intelligence (2-3 weeks)
   - Phase 3: Integrations (varies)
   - Go-live and training (2 weeks)

---

## Troubleshooting

### If data looks incomplete:
- Verify you're logged in with correct account
- Check that migrations ran successfully
- Confirm seed scripts executed

### If features don't work:
- Clear browser cache
- Check browser console for errors
- Verify database connection

### For best demo experience:
- Use Chrome or Firefox
- Screen resolution 1920x1080 or higher
- Stable internet connection
- Rehearse transitions between features

---

## Demo Tips

✅ **DO**:
- Start with business pain points
- Show real numbers and data
- Demonstrate workflows, not just features
- Ask questions and engage the audience
- Highlight automation and time savings

❌ **DON'T**:
- Rush through features
- Use technical jargon unnecessarily
- Show incomplete/broken features
- Read slides or documentation
- Forget to close the loop on value

---

## Success Metrics

After demo, prospect should understand:
- ✅ How the system accelerates quote generation
- ✅ How deal scores improve win rates and margins
- ✅ How commission automation reduces errors
- ✅ How cost alerts protect profitability
- ✅ ROI potential for their organization

**Target Demo Score**: 8/10 or higher on prospect feedback
