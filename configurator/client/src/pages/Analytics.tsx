import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, TrendingUp, GitMerge, Layers, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverallPerformance from "./analytics/OverallPerformance";
import ListPricePerformance from "./analytics/ListPricePerformance";
import QuoteFunnel from "./analytics/QuoteFunnel";
import PriceWaterfall from "./analytics/PriceWaterfall";

const MODULES = [
  {
    id: "overall",
    label: "Overall Performance",
    icon: BarChart2,
    description: "Revenue KPIs, price index vs cost index, and margin bridge analysis",
    component: OverallPerformance,
  },
  {
    id: "list-price",
    label: "List Price Performance",
    icon: TrendingUp,
    description: "Margin vs sales scatter, competitive premium cone, Pareto analysis, and discount distribution",
    component: ListPricePerformance,
  },
  {
    id: "quote-funnel",
    label: "Quote Funnel",
    icon: GitMerge,
    description: "Quote pipeline KPIs, stage conversion funnel, trends over time, and new vs repeat business",
    component: QuoteFunnel,
  },
  {
    id: "price-waterfall",
    label: "Price Waterfall",
    icon: Layers,
    description: "From list price to pocket price — full waterfall breakdown of all discounts and deductions",
    component: PriceWaterfall,
  },
];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overall");
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border/60 bg-card/50">
        <div className="max-w-screen-xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Pricing Intelligence</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                ITT Connectors — analytics across revenue, pricing, quote funnel, and margin performance
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live data
            </div>
          </div>
        </div>
      </div>

      {/* Module tabs */}
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 mb-6 rounded-xl border border-border/40">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <TabsTrigger
                  key={mod.id}
                  value={mod.id}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mod.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Module description bar */}
          <div className="mb-5 text-xs text-muted-foreground bg-muted/30 border border-border/40 rounded-lg px-4 py-2.5">
            {MODULES.find(m => m.id === activeTab)?.description}
          </div>

          {MODULES.map((mod) => (
            <TabsContent key={mod.id} value={mod.id} className="mt-0">
              <mod.component />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
