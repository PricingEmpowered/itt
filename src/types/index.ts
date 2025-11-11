export interface ProductFamily {
  id: string;
  name: string;
  description: string;
  parent_family_id?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  family_id?: string;
  attributes: Record<string, any>;
  base_cost: number;
  uom: string;
  status: string;
  created_at?: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  created_at?: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  date: string;
  created_at?: string;
}

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  currency_id?: string;
  effective_from: string;
  effective_to: string;
  version: number;
  created_at?: string;
}

export interface PriceListItem {
  id: number;
  price_list_id: string;
  product_id: string;
  list_price: number;
}

export interface QuantityBreak {
  id: string;
  product_id: string;
  price_list_id?: string | null;
  min_quantity: number;
  max_quantity?: number | null;
  discount_percent?: number | null;
  fixed_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Region {
  id: string;
  name: string;
  parent_region_id?: string;
  created_at?: string;
}

export interface Industry {
  id: string;
  name: string;
  parent_industry_id?: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  segment: string;
  region: string;
  region_id?: string;
  industry_id?: string;
  contact_email: string;
  annual_volume: number;
  annual_revenue?: number;
  attributes?: Record<string, any>;
  created_at?: string;
}

export interface CustomerPriceList {
  id: number;
  customer_id: string;
  price_list_id: string;
  is_default: boolean;
  priority: number;
  created_at?: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  segment: string;
  criteria: Record<string, any>;
  discount_percent: number;
  approval_threshold: number;
  stackable: boolean;
  active: boolean;
  created_at?: string;
}

export interface Quote {
  id: string;
  customer_id: string;
  price_list_id: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  currency_id?: string;
  exchange_rate?: number;
  created_by: string;
  approvals_required: number;
  deal_score?: number | null;
  deal_score_details?: DealScoreDetails | null;
  deal_score_calculated_at?: string | null;
  approval_requested_at?: string | null;
  final_approval_at?: string | null;
  turnaround_time_hours?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface DealScoreDetails {
  industry_avg_margin: number;
  region_avg_margin: number;
  industry_avg_discount: number;
  region_avg_discount: number;
  current_avg_margin: number;
  current_avg_discount: number;
  comparable_deals_count: number;
  percentile: number;
  score_factors: {
    margin_score: number;
    discount_score: number;
  };
}

export interface QuoteLine {
  id: number;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_applied: number;
  line_total: number;
}

export interface ApprovalRequest {
  id: string;
  quote_id: string;
  requested_by: string;
  requested_at: string;
  approver_role: string;
  approved_by?: string;
  approved_at?: string;
  status: string;
  reason: string;
  comments?: string;
}

export interface AuditLog {
  id: number;
  entity: string;
  entity_id: string;
  action: string;
  changed_by: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface PriceSimulation {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  price_change_percent: number;
  applies_to_families: string[];
  applies_to_products: string[];
  applies_to_customer_segments: string[];
  status: 'draft' | 'running' | 'completed';
}

export interface SimulationResult {
  id: string;
  simulation_id: string;
  scenario_type: 'best_case' | 'mid_case' | 'worst_case';
  projected_revenue: number;
  projected_margin: number;
  revenue_change_percent: number;
  volume_impact_percent: number;
  affected_customers: number;
  affected_products: number;
  confidence_score: number;
  rationale: {
    factors: string[];
    risks: string[];
    opportunities: string[];
    assumptions: string[];
  };
  created_at: string;
}

export interface SLATier {
  id: string;
  name: string;
  description: string;
  coverage_days: number;
  hours_per_day: number;
  response_time_hours: number;
  response_time_label: string;
  list_price_annual: number;
  list_price_monthly: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  sla_tier_id: string;
  base_price_annual: number;
  base_price_monthly: number;
  unit: string;
  is_active: boolean;
  features: string[];
  sla_tier?: SLATier;
}

export interface QuoteService {
  id: number;
  quote_id: string;
  service_id: string;
  billing_period: 'monthly' | 'annual';
  quantity: number;
  unit_price: number;
  discount_applied: number;
  line_total: number;
  contract_term_months: number;
  start_date?: string;
  end_date?: string;
  notes?: string;
}
