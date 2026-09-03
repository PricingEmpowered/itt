export interface PillarCriteria {
  id: number;
  text: string;
  weight: number;
}

export interface MaturityPillar {
  id: string;
  pillar_name: string;
  pillar_order: number;
  description: string;
  criteria: PillarCriteria[];
  max_score: number;
}

export interface MaturityAssessment {
  id: string;
  assessment_date: string;
  business_unit: string | null;
  pillar_id: string;
  score: number;
  maturity_level: 'not_started' | 'in_progress' | 'completed' | 'optimized';
  criteria_completion: Record<string, boolean>;
  notes: string | null;
}

export const calculatePillarScore = (
  criteria: PillarCriteria[],
  completion: Record<string, boolean>
): number => {
  let totalScore = 0;

  criteria.forEach((criterion) => {
    if (completion[criterion.id.toString()]) {
      totalScore += criterion.weight;
    }
  });

  return totalScore;
};

export const getMaturityLevel = (score: number): 'not_started' | 'in_progress' | 'completed' | 'optimized' => {
  if (score === 0) return 'not_started';
  if (score < 60) return 'in_progress';
  if (score < 90) return 'completed';
  return 'optimized';
};

export const getMaturityColor = (level: string): string => {
  switch (level) {
    case 'not_started':
      return 'text-slate-400 bg-slate-100';
    case 'in_progress':
      return 'text-yellow-600 bg-yellow-100';
    case 'completed':
      return 'text-blue-600 bg-blue-100';
    case 'optimized':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-slate-400 bg-slate-100';
  }
};

export const getMaturityLabel = (level: string): string => {
  switch (level) {
    case 'not_started':
      return 'Not Started';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'optimized':
      return 'Optimized';
    default:
      return 'Unknown';
  }
};

export const calculateOverallMaturity = (assessments: MaturityAssessment[]): number => {
  if (assessments.length === 0) return 0;

  const totalScore = assessments.reduce((sum, assessment) => sum + assessment.score, 0);
  return Math.round(totalScore / assessments.length);
};

export const getPillarRecommendations = (pillarName: string, _score: number): string[] => {
  const recommendations: Record<string, string[]> = {
    'Documentation and Measurement': [
      'Implement automated discount tracking across all distributors',
      'Create monthly margin vs sales plot reviews',
      'Establish PDCA cycles for continuous improvement',
      'Deploy win/loss tracking with standardized reason codes'
    ],
    'Process and Governance': [
      'Define discounting matrix with clear approval thresholds',
      'Document cost-to-serve methodology',
      'Implement variance reporting dashboards',
      'Establish delegation of authority framework'
    ],
    'List Prices': [
      'Complete competitive analysis for all major product lines',
      'Develop quantity break optimization models',
      'Create breakeven analysis templates',
      'Implement quarterly list price reviews'
    ],
    'Exception Pricing': [
      'Map all non-standard products to standard equivalents',
      'Build pricing decision trees',
      'Track win rates by exception type',
      'Create value analysis templates'
    ],
    'OEM Pricing': [
      'Complete OEM customer segmentation',
      'Develop indexing methodology',
      'Create multi-year pricing plans',
      'Implement quarterly business reviews'
    ],
    'Value Pricing': [
      'Develop value propositions for top 10 products',
      'Integrate VOC data into NPI process',
      'Create value quantification tools',
      'Train sales team on value selling'
    ]
  };

  return recommendations[pillarName] || [];
};
