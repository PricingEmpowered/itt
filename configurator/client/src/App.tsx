import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { QuoteProvider } from "./contexts/QuoteContext";
import Home from "./pages/Home";
import Configurator from "./pages/Configurator";
import Admin from "./pages/Admin";
import QuoteCart from "./pages/QuoteCart";
import Analytics from "./pages/Analytics";
import CompetitiveIntelligence from "./pages/CompetitiveIntelligence";
import CustomerManagement from "./pages/CustomerManagement";
import ProductManagement from "./pages/ProductManagement";
import PriceListManagement from "./pages/PriceListManagement";
import QuoteManagement from "./pages/QuoteManagement";
import QuoteWorkflow from "./pages/QuoteWorkflow";
import ApprovalQueue from "./pages/ApprovalQueue";
import CustomerAgreements from "./pages/CustomerAgreements";
import ChannelCompliance from "./pages/ChannelCompliance";
import MarginCausality from "./pages/MarginCausality";
import PricingRules from "./pages/PricingRules";
import BulkOpportunities from "./pages/BulkOpportunities";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/configure" component={Configurator} />
      <Route path="/configure/:family" component={Configurator} />
      <Route path="/quote" component={QuoteCart} />
      <Route path="/admin" component={Admin} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/competitive-intelligence" component={CompetitiveIntelligence} />
      <Route path="/customers" component={CustomerManagement} />
      <Route path="/products" component={ProductManagement} />
      <Route path="/price-lists" component={PriceListManagement} />
      <Route path="/quote-management" component={QuoteManagement} />
      <Route path="/quote-workflow" component={QuoteWorkflow} />
      <Route path="/approval-queue" component={ApprovalQueue} />
      <Route path="/agreements" component={CustomerAgreements} />
      <Route path="/channel-compliance" component={ChannelCompliance} />
      <Route path="/margin-causality" component={MarginCausality} />
      <Route path="/pricing-rules" component={PricingRules} />
      <Route path="/bulk-opportunities" component={BulkOpportunities} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <QuoteProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </QuoteProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
