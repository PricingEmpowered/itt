import { useState, lazy, Suspense } from 'react';
import { trpc } from './lib/trpc';
import { queryClient } from './lib/trpcClient';
import { Auth } from './components/Auth';
import { DashboardEnhanced } from './components/DashboardEnhanced';
import { NavigationMenu } from './components/NavigationMenu';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LogOut } from 'lucide-react';

const ProductCatalog = lazy(() => import('./components/ProductCatalog').then(m => ({ default: m.ProductCatalog })));
const QuoteBuilder = lazy(() => import('./components/QuoteBuilder').then(m => ({ default: m.QuoteBuilder })));
const Approvals = lazy(() => import('./components/Approvals').then(m => ({ default: m.Approvals })));
const Customers = lazy(() => import('./components/Customers').then(m => ({ default: m.Customers })));
const PriceLists = lazy(() => import('./components/PriceLists').then(m => ({ default: m.PriceLists })));
const Users = lazy(() => import('./components/Users').then(m => ({ default: m.Users })));
const Quotes = lazy(() => import('./components/Quotes').then(m => ({ default: m.Quotes })));
const QuantityBreaks = lazy(() => import('./components/QuantityBreaks').then(m => ({ default: m.QuantityBreaks })));
const QuantityBreaksAnalytics = lazy(() => import('./components/QuantityBreaksAnalytics').then(m => ({ default: m.QuantityBreaksAnalytics })));
const PriceSimulation = lazy(() => import('./components/PriceSimulation').then(m => ({ default: m.PriceSimulation })));
const DealScoreAnalytics = lazy(() => import('./components/DealScoreAnalytics').then(m => ({ default: m.DealScoreAnalytics })));
const Analytics = lazy(() => import('./components/Analytics').then(m => ({ default: m.Analytics })));
const Services = lazy(() => import('./components/Services').then(m => ({ default: m.Services })));
const PriceAlerts = lazy(() => import('./components/PriceAlerts').then(m => ({ default: m.PriceAlerts })));
const Commissions = lazy(() => import('./components/Commissions').then(m => ({ default: m.Commissions })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const PricingExcellence = lazy(() => import('./components/PricingExcellence').then(m => ({ default: m.PricingExcellence })));
const AIAnalytics = lazy(() => import('./components/AIAnalytics').then(m => ({ default: m.AIAnalytics })));
const AIQuestionLibrary = lazy(() => import('./components/AIQuestionLibrary').then(m => ({ default: m.AIQuestionLibrary })));
const RulesPricingEngine = lazy(() => import('./components/RulesPricingEngine').then(m => ({ default: m.RulesPricingEngine })));
const MarketingReport = lazy(() => import('./components/MarketingReport').then(m => ({ default: m.MarketingReport })));

type View = 'dashboard' | 'products' | 'services' | 'quotes' | 'approvals' | 'customers' | 'pricelists' | 'users' | 'allquotes' | 'quantitybreaks' | 'quantitybreaks-analytics' | 'simulation' | 'analytics' | 'dealscoreanalytics' | 'pricealerts' | 'commissions' | 'settings' | 'excellence' | 'ai-analytics' | 'ai-questions' | 'rules-pricing' | 'marketing-report';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  /*
   * The session lives in an httpOnly cookie, so the client cannot read it
   * directly and asks the server instead. This query is the single source of
   * truth for whether anyone is signed in.
   */
  const { data: user, isLoading: loading, refetch: refetchUser } = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  const signOut = trpc.auth.signOut.useMutation({
    onSettled: () => {
      // Drop every cached query so one user's data cannot be read from the
      // cache after a different user signs in on the same browser.
      queryClient.clear();
      refetchUser();
    },
  });

  const handleSignOut = () => signOut.mutate();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => refetchUser()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <nav className="gradient-dark shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="/price space logo.png"
                alt="Price Space"
                className="h-12 object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black text-sm font-semibold">
                  {(user.fullName || user.email).charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-200 font-medium">
                  {user.fullName || user.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all border border-transparent hover:border-slate-700"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-72 bg-white min-h-screen shadow-xl border-r border-slate-200 overflow-y-auto">
          <NavigationMenu currentView={currentView} onViewChange={setCurrentView} />
        </aside>

        <main className="flex-1 p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<LoadingSpinner />}>
              {currentView === 'dashboard' && <DashboardEnhanced />}
              {currentView === 'products' && <ProductCatalog />}
              {currentView === 'services' && <Services />}
              {currentView === 'quotes' && <QuoteBuilder />}
              {currentView === 'allquotes' && <Quotes />}
              {currentView === 'approvals' && <Approvals />}
              {currentView === 'customers' && <Customers />}
              {currentView === 'pricelists' && <PriceLists />}
              {currentView === 'quantitybreaks' && <QuantityBreaks />}
              {currentView === 'quantitybreaks-analytics' && <QuantityBreaksAnalytics />}
              {currentView === 'analytics' && <Analytics />}
              {currentView === 'ai-analytics' && <AIAnalytics />}
              {currentView === 'ai-questions' && <AIQuestionLibrary />}
              {currentView === 'dealscoreanalytics' && <DealScoreAnalytics />}
              {currentView === 'simulation' && <PriceSimulation />}
              {currentView === 'rules-pricing' && <RulesPricingEngine />}
              {currentView === 'pricealerts' && <PriceAlerts />}
              {currentView === 'commissions' && <Commissions />}
              {currentView === 'excellence' && <PricingExcellence />}
              {currentView === 'users' && <Users />}
              {currentView === 'settings' && <Settings />}
              {currentView === 'marketing-report' && <MarketingReport />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
