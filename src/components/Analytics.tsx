import { useState } from 'react';
import { BarChart3, TrendingUp, Filter, Layers } from 'lucide-react';
import { BusinessPerformance } from './analytics/BusinessPerformance';
import { ListPricePerformance } from './analytics/ListPricePerformance';
import { QuoteFunnelAnalysis } from './analytics/QuoteFunnelAnalysis';
import { PriceWaterfallAnalysis } from './analytics/PriceWaterfallAnalysis';

type AnalyticsView = 'business' | 'pricing' | 'funnel' | 'waterfall';

export function Analytics() {
  const [currentView, setCurrentView] = useState<AnalyticsView>('business');

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <BarChart3 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Pricing Analytics</h1>
            <p className="text-blue-100 mt-1">Business Intelligence & Performance Insights</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-6 px-6">
            <AnalyticsTab
              icon={<BarChart3 size={16} />}
              label="Business Performance"
              active={currentView === 'business'}
              onClick={() => setCurrentView('business')}
            />
            <AnalyticsTab
              icon={<TrendingUp size={16} />}
              label="List Price Performance"
              active={currentView === 'pricing'}
              onClick={() => setCurrentView('pricing')}
            />
            <AnalyticsTab
              icon={<Filter size={16} />}
              label="Quote Funnel"
              active={currentView === 'funnel'}
              onClick={() => setCurrentView('funnel')}
            />
            <AnalyticsTab
              icon={<Layers size={16} />}
              label="Price Waterfall"
              active={currentView === 'waterfall'}
              onClick={() => setCurrentView('waterfall')}
            />
          </div>
        </div>

        <div className="p-6">
          {currentView === 'business' && <BusinessPerformance />}
          {currentView === 'pricing' && <ListPricePerformance />}
          {currentView === 'funnel' && <QuoteFunnelAnalysis />}
          {currentView === 'waterfall' && <PriceWaterfallAnalysis />}
        </div>
      </div>
    </div>
  );
}

interface AnalyticsTabProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function AnalyticsTab({ icon, label, active, onClick }: AnalyticsTabProps) {
  return (
    <button
      onClick={onClick}
      className={`py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
    </button>
  );
}
