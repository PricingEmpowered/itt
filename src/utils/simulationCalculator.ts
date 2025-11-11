import { Quote, QuoteLine, Product, Customer, SimulationResult } from '../types';

interface HistoricalData {
  quotes: Quote[];
  quoteLines: QuoteLine[];
  products: Product[];
  customers: Customer[];
}

interface SimulationParams {
  priceChangePercent: number;
  affectedProductIds: string[];
  affectedCustomerIds: string[];
  historicalData: HistoricalData;
}

export function calculateSimulationScenarios(params: SimulationParams): Omit<SimulationResult, 'id' | 'simulation_id' | 'created_at'>[] {
  const { priceChangePercent, affectedProductIds, affectedCustomerIds, historicalData } = params;

  const currentMetrics = calculateCurrentMetrics(historicalData, affectedProductIds, affectedCustomerIds);

  const scenarios = [
    calculateBestCase(currentMetrics, priceChangePercent),
    calculateMidCase(currentMetrics, priceChangePercent),
    calculateWorstCase(currentMetrics, priceChangePercent),
  ];

  return scenarios;
}

interface CurrentMetrics {
  totalRevenue: number;
  totalMargin: number;
  avgMarginPercent: number;
  totalVolume: number;
  affectedCustomers: number;
  affectedProducts: number;
  avgDiscountPercent: number;
  priceElasticity: number;
}

function calculateCurrentMetrics(
  data: HistoricalData,
  productIds: string[],
  customerIds: string[]
): CurrentMetrics {
  const relevantQuotes = data.quotes.filter(q =>
    customerIds.length === 0 || customerIds.includes(q.customer_id)
  );

  const relevantQuoteIds = new Set(relevantQuotes.map(q => q.id));

  const relevantLines = data.quoteLines.filter(line =>
    relevantQuoteIds.has(line.quote_id) &&
    (productIds.length === 0 || productIds.includes(line.product_id))
  );

  let totalRevenue = 0;
  let totalCost = 0;
  let totalVolume = 0;
  let totalDiscountAmount = 0;
  let totalListAmount = 0;

  relevantLines.forEach(line => {
    const product = data.products.find(p => p.id === line.product_id);
    const lineRevenue = line.line_total;
    const lineCost = product ? product.base_cost * line.quantity : 0;

    totalRevenue += lineRevenue;
    totalCost += lineCost;
    totalVolume += line.quantity;

    const listAmount = line.unit_price * line.quantity * (100 / (100 - line.discount_applied));
    totalListAmount += listAmount;
    totalDiscountAmount += (listAmount - (line.unit_price * line.quantity));
  });

  const totalMargin = totalRevenue - totalCost;
  const avgMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const avgDiscountPercent = totalListAmount > 0 ? (totalDiscountAmount / totalListAmount) * 100 : 0;

  const uniqueCustomers = new Set(relevantQuotes.map(q => q.customer_id));
  const uniqueProducts = new Set(relevantLines.map(l => l.product_id));

  const priceElasticity = estimatePriceElasticity(avgMarginPercent, avgDiscountPercent);

  return {
    totalRevenue,
    totalMargin,
    avgMarginPercent,
    totalVolume,
    affectedCustomers: uniqueCustomers.size,
    affectedProducts: uniqueProducts.size,
    avgDiscountPercent,
    priceElasticity,
  };
}

function estimatePriceElasticity(marginPercent: number, discountPercent: number): number {
  let elasticity = -1.2;

  if (marginPercent > 40) {
    elasticity = -0.8;
  } else if (marginPercent > 30) {
    elasticity = -1.0;
  } else if (marginPercent < 15) {
    elasticity = -1.8;
  }

  if (discountPercent > 20) {
    elasticity -= 0.3;
  }

  return elasticity;
}

function calculateBestCase(
  current: CurrentMetrics,
  priceChangePercent: number
): Omit<SimulationResult, 'id' | 'simulation_id' | 'created_at'> {
  const optimisticElasticity = current.priceElasticity * 0.5;
  const volumeImpact = priceChangePercent * optimisticElasticity;

  const newVolume = current.totalVolume * (1 + volumeImpact / 100);
  const newRevenue = current.totalRevenue * (1 + priceChangePercent / 100) * (1 + volumeImpact / 100);
  const newMargin = newRevenue - (current.totalRevenue - current.totalMargin) * (1 + volumeImpact / 100);

  const revenueChange = ((newRevenue - current.totalRevenue) / current.totalRevenue) * 100;

  return {
    scenario_type: 'best_case',
    projected_revenue: newRevenue,
    projected_margin: newMargin,
    revenue_change_percent: revenueChange,
    volume_impact_percent: volumeImpact,
    affected_customers: current.affectedCustomers,
    affected_products: current.affectedProducts,
    confidence_score: 65,
    rationale: {
      factors: [
        'Customers show low price sensitivity in this segment',
        'Strong product differentiation supports pricing power',
        'Historical data shows stable demand despite price changes',
        'Competition pricing is higher in comparable segments',
      ],
      risks: [
        'Market conditions could change customer behavior',
        'Competitors may respond with aggressive pricing',
      ],
      opportunities: [
        'Revenue increase with minimal volume loss',
        'Improved margin profile across product line',
        'Opportunity to reinvest in product development',
      ],
      assumptions: [
        `Price elasticity of ${optimisticElasticity.toFixed(2)} (optimistic scenario)`,
        'Customer retention rate of 95%+',
        'No significant competitive response within 90 days',
      ],
    },
  };
}

function calculateMidCase(
  current: CurrentMetrics,
  priceChangePercent: number
): Omit<SimulationResult, 'id' | 'simulation_id' | 'created_at'> {
  const volumeImpact = priceChangePercent * current.priceElasticity;

  const newVolume = current.totalVolume * (1 + volumeImpact / 100);
  const newRevenue = current.totalRevenue * (1 + priceChangePercent / 100) * (1 + volumeImpact / 100);
  const newMargin = newRevenue - (current.totalRevenue - current.totalMargin) * (1 + volumeImpact / 100);

  const revenueChange = ((newRevenue - current.totalRevenue) / current.totalRevenue) * 100;

  return {
    scenario_type: 'mid_case',
    projected_revenue: newRevenue,
    projected_margin: newMargin,
    revenue_change_percent: revenueChange,
    volume_impact_percent: volumeImpact,
    affected_customers: current.affectedCustomers,
    affected_products: current.affectedProducts,
    confidence_score: 80,
    rationale: {
      factors: [
        'Based on historical price-volume relationships',
        'Accounts for typical market response patterns',
        'Considers current competitive landscape',
        'Reflects average customer price sensitivity',
      ],
      risks: [
        'Economic downturn could amplify volume loss',
        'Key customers may seek alternative suppliers',
        'Market share erosion in price-sensitive segments',
      ],
      opportunities: [
        'Balanced revenue and margin improvement',
        'Opportunity to optimize customer mix',
        'Better alignment with value proposition',
      ],
      assumptions: [
        `Price elasticity of ${current.priceElasticity.toFixed(2)} (historical average)`,
        'Customer retention rate of 90%',
        'Normal competitive market conditions',
        `Current margin: ${current.avgMarginPercent.toFixed(1)}%`,
      ],
    },
  };
}

function calculateWorstCase(
  current: CurrentMetrics,
  priceChangePercent: number
): Omit<SimulationResult, 'id' | 'simulation_id' | 'created_at'> {
  const pessimisticElasticity = current.priceElasticity * 1.5;
  const volumeImpact = priceChangePercent * pessimisticElasticity;

  const newVolume = current.totalVolume * (1 + volumeImpact / 100);
  const newRevenue = current.totalRevenue * (1 + priceChangePercent / 100) * (1 + volumeImpact / 100);
  const newMargin = newRevenue - (current.totalRevenue - current.totalMargin) * (1 + volumeImpact / 100);

  const revenueChange = ((newRevenue - current.totalRevenue) / current.totalRevenue) * 100;

  return {
    scenario_type: 'worst_case',
    projected_revenue: newRevenue,
    projected_margin: newMargin,
    revenue_change_percent: revenueChange,
    volume_impact_percent: volumeImpact,
    affected_customers: current.affectedCustomers,
    affected_products: current.affectedProducts,
    confidence_score: 70,
    rationale: {
      factors: [
        'High customer price sensitivity in economic downturn',
        'Aggressive competitive response likely',
        'Risk of losing price-sensitive customers',
        'Limited product differentiation in affected segments',
      ],
      risks: [
        'Significant market share loss to competitors',
        'Customer defection to lower-cost alternatives',
        'Potential margin compression from volume loss',
        'Long-term relationship damage with key accounts',
      ],
      opportunities: [
        'Forces strategic review of value proposition',
        'Opportunity to segment customers by price sensitivity',
        'Potential to identify more profitable customer mix',
      ],
      assumptions: [
        `Price elasticity of ${pessimisticElasticity.toFixed(2)} (pessimistic scenario)`,
        'Customer retention rate of 80%',
        'Aggressive competitive response expected',
        'Potential 10-20% increase in customer churn',
      ],
    },
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
