import { useState } from 'react';
import { ChevronDown, ChevronRight, LayoutDashboard, Package, Headphones, FileText, ClipboardList, CheckSquare, UsersIcon, DollarSign, Layers, TrendingUp, Workflow, BarChart3, Brain, BookOpen, Bell, Percent, Award, UserCircle, Settings as SettingsIcon, Target } from 'lucide-react';

type View = 'dashboard' | 'products' | 'services' | 'quotes' | 'approvals' | 'customers' | 'pricelists' | 'users' | 'allquotes' | 'quantitybreaks' | 'quantitybreaks-analytics' | 'simulation' | 'analytics' | 'dealscoreanalytics' | 'pricealerts' | 'commissions' | 'settings' | 'excellence' | 'ai-analytics' | 'ai-questions' | 'rules-pricing';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}

function NavItem({ icon, label, active, onClick, indent = false }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        indent ? 'pl-11' : ''
      } ${
        active
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

interface NavGroupProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function NavGroup({ icon, label, children, defaultExpanded = false }: NavGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all"
      >
        <span className="text-slate-400">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {expanded && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}

interface Props {
  currentView: View;
  onViewChange: (view: View) => void;
}

export function NavigationMenu({ currentView, onViewChange }: Props) {
  return (
    <nav className="p-6 space-y-2">
      <NavItem
        icon={<LayoutDashboard size={20} />}
        label="Dashboard"
        active={currentView === 'dashboard'}
        onClick={() => onViewChange('dashboard')}
      />

      <div className="pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">
          Core Operations
        </div>
        <div className="space-y-1">
          <NavGroup icon={<FileText size={20} />} label="Quotes" defaultExpanded={true}>
            <NavItem
              icon={<FileText size={18} />}
              label="Create Quote"
              active={currentView === 'quotes'}
              onClick={() => onViewChange('quotes')}
              indent
            />
            <NavItem
              icon={<ClipboardList size={18} />}
              label="All Quotes"
              active={currentView === 'allquotes'}
              onClick={() => onViewChange('allquotes')}
              indent
            />
            <NavItem
              icon={<CheckSquare size={18} />}
              label="Approvals"
              active={currentView === 'approvals'}
              onClick={() => onViewChange('approvals')}
              indent
            />
          </NavGroup>

          <NavItem
            icon={<UsersIcon size={20} />}
            label="Customers"
            active={currentView === 'customers'}
            onClick={() => onViewChange('customers')}
          />

          <NavGroup icon={<Package size={20} />} label="Catalog" defaultExpanded={false}>
            <NavItem
              icon={<Package size={18} />}
              label="Products"
              active={currentView === 'products'}
              onClick={() => onViewChange('products')}
              indent
            />
            <NavItem
              icon={<Headphones size={18} />}
              label="Services"
              active={currentView === 'services'}
              onClick={() => onViewChange('services')}
              indent
            />
          </NavGroup>
        </div>
      </div>

      <div className="pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">
          Pricing Management
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<DollarSign size={20} />}
            label="Price Lists"
            active={currentView === 'pricelists'}
            onClick={() => onViewChange('pricelists')}
          />
          <NavGroup icon={<Layers size={20} />} label="Quantity Breaks" defaultExpanded={false}>
            <NavItem
              icon={<Layers size={18} />}
              label="Manage Breaks"
              active={currentView === 'quantitybreaks'}
              onClick={() => onViewChange('quantitybreaks')}
              indent
            />
            <NavItem
              icon={<BarChart3 size={18} />}
              label="Break Analytics"
              active={currentView === 'quantitybreaks-analytics'}
              onClick={() => onViewChange('quantitybreaks-analytics')}
              indent
            />
          </NavGroup>
          <NavItem
            icon={<Workflow size={20} />}
            label="Rules Pricing"
            active={currentView === 'rules-pricing'}
            onClick={() => onViewChange('rules-pricing')}
          />
          <NavItem
            icon={<TrendingUp size={20} />}
            label="Price Simulation"
            active={currentView === 'simulation'}
            onClick={() => onViewChange('simulation')}
          />
          <NavItem
            icon={<Bell size={20} />}
            label="Price Alerts"
            active={currentView === 'pricealerts'}
            onClick={() => onViewChange('pricealerts')}
          />
        </div>
      </div>

      <div className="pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">
          Analytics & Insights
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<BarChart3 size={20} />}
            label="Analytics"
            active={currentView === 'analytics'}
            onClick={() => onViewChange('analytics')}
          />
          <NavItem
            icon={<Target size={20} />}
            label="Deal Score Analytics"
            active={currentView === 'dealscoreanalytics'}
            onClick={() => onViewChange('dealscoreanalytics')}
          />
          <NavGroup icon={<Brain size={20} />} label="AI Analytics" defaultExpanded={false}>
            <NavItem
              icon={<Brain size={18} />}
              label="Ask AI"
              active={currentView === 'ai-analytics'}
              onClick={() => onViewChange('ai-analytics')}
              indent
            />
            <NavItem
              icon={<BookOpen size={18} />}
              label="Question Library"
              active={currentView === 'ai-questions'}
              onClick={() => onViewChange('ai-questions')}
              indent
            />
          </NavGroup>
          <NavItem
            icon={<Award size={20} />}
            label="Pricing Excellence"
            active={currentView === 'excellence'}
            onClick={() => onViewChange('excellence')}
          />
        </div>
      </div>

      <div className="pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">
          Operations
        </div>
        <div className="space-y-1">
          <NavItem
            icon={<Percent size={20} />}
            label="Commissions"
            active={currentView === 'commissions'}
            onClick={() => onViewChange('commissions')}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-200">
        <div className="mt-2 space-y-1">
          <NavItem
            icon={<UserCircle size={20} />}
            label="Users"
            active={currentView === 'users'}
            onClick={() => onViewChange('users')}
          />
          <NavItem
            icon={<SettingsIcon size={20} />}
            label="Settings"
            active={currentView === 'settings'}
            onClick={() => onViewChange('settings')}
          />
        </div>
      </div>
    </nav>
  );
}
