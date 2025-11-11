interface CommissionTier {
  id: string;
  name: string;
  min_deal_size: number;
  max_deal_size: number | null;
  min_deal_score: number;
  base_commission_percent: number;
  deal_score_bonus_percent: number;
  is_active: boolean;
}

interface CommissionCalculation {
  tier: CommissionTier | null;
  baseCommissionPercent: number;
  dealScoreBonusPercent: number;
  totalCommissionPercent: number;
  commissionAmount: number;
  qualifiesForBonus: boolean;
}

export function calculateCommission(
  dealSize: number,
  dealScore: number | null,
  tiers: CommissionTier[]
): CommissionCalculation {
  // Find the appropriate tier based on deal size
  const applicableTier = tiers
    .filter(tier => tier.is_active)
    .filter(tier => {
      const meetsMin = dealSize >= tier.min_deal_size;
      const meetsMax = tier.max_deal_size === null || dealSize <= tier.max_deal_size;
      return meetsMin && meetsMax;
    })
    .sort((a, b) => b.min_deal_size - a.min_deal_size)[0]; // Get highest tier that applies

  if (!applicableTier) {
    // No tier found, use default 3%
    return {
      tier: null,
      baseCommissionPercent: 3.0,
      dealScoreBonusPercent: 0,
      totalCommissionPercent: 3.0,
      commissionAmount: dealSize * 0.03,
      qualifiesForBonus: false
    };
  }

  const basePercent = applicableTier.base_commission_percent;
  const qualifiesForBonus = dealScore !== null && dealScore >= applicableTier.min_deal_score;
  const bonusPercent = qualifiesForBonus ? applicableTier.deal_score_bonus_percent : 0;
  const totalPercent = basePercent + bonusPercent;
  const commissionAmount = dealSize * (totalPercent / 100);

  return {
    tier: applicableTier,
    baseCommissionPercent: basePercent,
    dealScoreBonusPercent: bonusPercent,
    totalCommissionPercent: totalPercent,
    commissionAmount,
    qualifiesForBonus
  };
}

export function formatCommissionDetails(calc: CommissionCalculation): string {
  if (!calc.tier) {
    return `Base: ${calc.baseCommissionPercent.toFixed(1)}% | Total: $${calc.commissionAmount.toFixed(2)}`;
  }

  let details = `Tier: ${calc.tier.name} | Base: ${calc.baseCommissionPercent.toFixed(1)}%`;

  if (calc.qualifiesForBonus && calc.dealScoreBonusPercent > 0) {
    details += ` + Bonus: ${calc.dealScoreBonusPercent.toFixed(1)}%`;
  }

  details += ` = ${calc.totalCommissionPercent.toFixed(1)}% | Amount: $${calc.commissionAmount.toFixed(2)}`;

  return details;
}
