# Rules-Based Pricing Integration

## Overview
Integrated the rules-based pricing engine into the quote creation workflow, allowing sales reps to calculate prices for non-standard or custom products using decision-tree logic.

## How It Works

### In Quote Builder
When creating a quote, users can now:

1. **Add a line item** without selecting an existing product
2. **Click "Calculate Non-Standard Price"** button (appears when no product is selected)
3. **Configure pricing parameters** in the modal:
   - Customer segment (Large/Med/Small) - auto-populated from customer
   - Complexity level (Low/Med/High) - with helpful descriptions
   - Competition factors
   - Whether customer has existing product
   - Variation of standard vs. non-standard product

### Two Pricing Methods

#### 1. Multiplier Pricing (Variation of Standard)
- For products that are variations of existing standard products
- **Select closest standard product** from searchable dropdown (optional)
- Auto-fills list price when product selected, or enter manually
- **Describe what makes it unique** (required) - documents customizations
- Formula: `List Price of Standard Product × Multiplier`
- Multipliers range from 1.00x to 2.00x based on factors
- Example: Standard product $1,000 × 1.35 multiplier = $1,350
- Shows base product name in calculation results

#### 2. Cost-Plus Pricing (Non-Standard Assembly)
- For completely custom/non-standard products
- Enter product cost and optional market segment
- **Describe the product** (required) - captures specifications
- Formula: `Cost × (Standard Margin + Adder %)`
- Includes optional market segment adders
- Example: Cost $500 × (1.40 + 0.07) = $735

### Strategic Review Threshold
- If opportunity exceeds $100K threshold → requires strategic review
- System prevents automatic pricing and alerts user

## Database Tables

### pricing_rules_config
Stores decision tree configurations and rules

### pricing_multipliers
36 pre-configured multipliers based on:
- Customer segment (Large/Med/Small)
- Has existing product (Yes/No)
- Has competition (Yes/No)
- Complexity (Low/Med/High)

### pricing_margin_adders
Margin additives for cost-plus pricing including:
- Base margin adders
- Market-specific adders (Construction, Crane, Energy/Oil, Military)

### pricing_rule_decisions
Audit log of all pricing decisions made

### product_complexity_attributes
Define complexity levels for products

## User Experience

### For Variation of Standard Product:
1. **In Create Quote screen**: Add line → Leave product blank
2. **Click** "Calculate Non-Standard Price" button
3. **Search and select** the closest standard product (optional but recommended)
   - System auto-fills the list price
   - Or manually enter the standard product price
4. **Describe what's unique** about this variation (required)
   - Example: "Special high-pressure seals, non-standard gear widths"
5. **Set complexity** and other factors
6. **Calculate** and review:
   - Shows base product name
   - Shows pricing formula
   - Displays unique description
7. **Apply** price directly to quote line

### For Non-Standard/Custom Product:
1. **In Create Quote screen**: Add line → Leave product blank
2. **Click** "Calculate Non-Standard Price" button
3. **Uncheck** "Variation of Standard Product"
4. **Enter product cost** and select market segment
5. **Describe the product** specifications (required)
6. **Set complexity** and other factors
7. **Calculate** and review price with full breakdown
8. **Apply** price directly to quote line

## Pre-Configured Rules

Based on GPD Non-Standard Pricing Decision Tree:

**Example Multipliers:**
- Large Customer, No Competition, High Complexity: 1.85x
- Med Customer, Has Competition: 1.00x (competitive)
- Small Customer, New Product, Med Complexity: 1.35x

**Market Adders:**
- Construction: +3%
- Crane: +2%
- Energy/Oil: +7%
- Military: +7%

## Benefits

1. **Consistency**: Standardized pricing across all sales reps
2. **Speed**: Calculate complex prices in seconds
3. **Audit Trail**: All pricing decisions logged with details
4. **Flexibility**: Supports both variations and custom products
5. **Governance**: Automatic escalation for large opportunities
6. **Documentation**: Required descriptions capture what makes each product unique
7. **Traceability**: Links variations back to standard products
8. **Knowledge Capture**: Preserves pricing rationale for future reference
