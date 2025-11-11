export const SCHEMA_CATALOG = {
  description: "CPQ Analytics Database - Secure, anonymized views for pricing and quote analysis",

  views: {
    customer_metrics: {
      description: "Customer performance metrics with anonymized names",
      columns: {
        customer_name: { type: "text", description: "Anonymized customer identifier (e.g., 'Customer abc123ef')" },
        segment: { type: "text", description: "Customer segment (Enterprise, Mid-Market, SMB)" },
        region: { type: "text", description: "Geographic region (North America, EMEA, APAC)" },
        total_quotes: { type: "bigint", description: "Total number of quotes for this customer" },
        won_quotes: { type: "bigint", description: "Number of approved/won quotes" },
        lost_quotes: { type: "bigint", description: "Number of rejected/lost quotes" },
        win_rate_pct: { type: "numeric", description: "Win rate percentage (won / (won + lost))" },
        total_revenue: { type: "numeric", description: "Total revenue from approved quotes in USD" },
        avg_deal_size: { type: "numeric", description: "Average deal size for approved quotes in USD" },
        first_quote_date: { type: "timestamp", description: "Date of first quote" },
        last_quote_date: { type: "timestamp", description: "Date of most recent quote" },
        customer_age_years: { type: "integer", description: "Years since customer was created" }
      },
      example_queries: [
        "Show top 10 customers by revenue",
        "What's the win rate for Enterprise segment customers?",
        "Which customers have the highest average deal size?"
      ]
    },

    product_metrics: {
      description: "Product and product family performance metrics",
      columns: {
        product_family: { type: "text", description: "Product family name (Valves, Pumps, Accessories, Flow Control, Controls & Automation)" },
        product_name: { type: "text", description: "Product name" },
        product_id: { type: "text", description: "Product identifier" },
        times_quoted: { type: "bigint", description: "Number of quotes containing this product" },
        times_won: { type: "bigint", description: "Number of won quotes containing this product" },
        total_revenue: { type: "numeric", description: "Total revenue from this product in USD" },
        avg_unit_price: { type: "numeric", description: "Average unit price" },
        avg_quantity: { type: "numeric", description: "Average quantity per quote" },
        avg_discount_amount: { type: "numeric", description: "Average discount amount applied" }
      },
      example_queries: [
        "Which product families generate the most revenue?",
        "What products have the highest win rate?",
        "Show products with declining quote volume"
      ]
    },

    quote_metrics: {
      description: "Individual quote metrics with anonymized customer and user info",
      columns: {
        quote_id: { type: "text", description: "Quote identifier" },
        customer_name: { type: "text", description: "Anonymized customer name" },
        segment: { type: "text", description: "Customer segment" },
        region: { type: "text", description: "Customer region" },
        sales_rep: { type: "text", description: "Anonymized sales rep identifier" },
        status: { type: "text", description: "Quote status (Draft, Pending Approval, Under Review, Approved, Rejected)" },
        quote_value: { type: "numeric", description: "Total quote value in USD" },
        avg_discount_pct: { type: "numeric", description: "Average discount percentage across line items" },
        currency: { type: "text", description: "Currency code (USD, EUR, GBP)" },
        deal_score: { type: "numeric", description: "AI-calculated deal score (0-100)" },
        quote_month: { type: "date", description: "Month of quote creation" },
        quote_year: { type: "integer", description: "Year of quote creation" },
        quote_quarter: { type: "integer", description: "Quarter of quote creation (1-4)" },
        line_items_count: { type: "bigint", description: "Number of line items in quote" },
        processing_hours: { type: "numeric", description: "Hours to process/approve quote" }
      },
      example_queries: [
        "Show average deal size by quarter",
        "What's the correlation between deal score and win rate?",
        "Which sales reps have the fastest quote turnaround time?"
      ]
    },

    pricing_metrics: {
      description: "Pricing performance by product family, segment, and region over time",
      columns: {
        product_family: { type: "text", description: "Product family name" },
        segment: { type: "text", description: "Customer segment" },
        region: { type: "text", description: "Geographic region" },
        period_month: { type: "date", description: "Month period" },
        quote_count: { type: "bigint", description: "Number of quotes in this period" },
        avg_unit_price: { type: "numeric", description: "Average unit price" },
        avg_discount_amount: { type: "numeric", description: "Average discount amount" },
        avg_won_price: { type: "numeric", description: "Average price for won quotes" },
        avg_lost_price: { type: "numeric", description: "Average price for lost quotes" },
        total_revenue: { type: "numeric", description: "Total revenue in period" }
      },
      example_queries: [
        "Show pricing trends for Valves over the last 12 months",
        "Compare average discounts by segment",
        "Which regions have the highest price realization?"
      ]
    },

    time_series_metrics: {
      description: "Time-based business metrics aggregated by month",
      columns: {
        period_month: { type: "date", description: "Month period" },
        year: { type: "integer", description: "Year" },
        quarter: { type: "integer", description: "Quarter (1-4)" },
        month: { type: "integer", description: "Month (1-12)" },
        total_quotes: { type: "bigint", description: "Total quotes in period" },
        won_quotes: { type: "bigint", description: "Won quotes in period" },
        lost_quotes: { type: "bigint", description: "Lost quotes in period" },
        unique_customers: { type: "bigint", description: "Number of unique customers" },
        total_revenue: { type: "numeric", description: "Total revenue in USD" },
        avg_deal_size: { type: "numeric", description: "Average deal size" },
        win_rate_pct: { type: "numeric", description: "Win rate percentage" }
      },
      example_queries: [
        "Show monthly revenue trends for 2024",
        "What's the win rate trend over the last 12 months?",
        "Compare Q1 vs Q2 performance"
      ]
    },

    regional_metrics: {
      description: "Performance metrics aggregated by region and segment",
      columns: {
        region: { type: "text", description: "Geographic region" },
        segment: { type: "text", description: "Customer segment" },
        customer_count: { type: "bigint", description: "Number of customers" },
        quote_count: { type: "bigint", description: "Total quotes" },
        won_quotes: { type: "bigint", description: "Won quotes" },
        total_revenue: { type: "numeric", description: "Total revenue in USD" },
        avg_deal_size: { type: "numeric", description: "Average deal size" },
        win_rate_pct: { type: "numeric", description: "Win rate percentage" }
      },
      example_queries: [
        "Compare performance across all regions",
        "Which region has the highest win rate for Enterprise customers?",
        "Show EMEA vs North America metrics"
      ]
    }
  },

  query_rules: {
    allowed_operations: ["SELECT"],
    forbidden_operations: ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"],
    max_results: 1000,
    required_aggregations: false,
    allowed_schemas: ["analytics_secure"],
    forbidden_patterns: [
      "pg_", "information_schema", "auth.", "public."
    ]
  },

  common_metrics: {
    revenue: "Total revenue from approved quotes",
    win_rate: "Percentage of approved quotes vs total decided quotes (approved + rejected)",
    avg_deal_size: "Average value of approved quotes",
    quote_count: "Total number of quotes",
    turnaround_time: "Hours from quote creation to approval/rejection"
  }
};

export type ViewName = keyof typeof SCHEMA_CATALOG.views;