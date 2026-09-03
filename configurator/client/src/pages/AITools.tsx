import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { Brain, TrendingUp, Users, AlertTriangle, Zap, RefreshCw, CheckCircle, Clock, Activity, ArrowLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { toast } from "sonner";

const MODEL_ICONS: Record<string, React.ElementType> = {
  price_optimization: TrendingUp,
  demand_forecasting: Activity,
  customer_analytics: Users,
  anomaly_detection: AlertTriangle,
};

const MODEL_COLORS: Record<string, string> = {
  price_optimization: "#1a56db",
  demand_forecasting: "#9061f9",
  customer_analytics: "#31c48d",
  anomaly_detection: "#f59e0b",
};

const MODEL_DESCRIPTIONS: Record<string, string> = {
  price_optimization: "Analyzes market conditions, competitor pricing, and demand signals to recommend optimal price points across all ITT connector families.",
  demand_forecasting: "Predicts demand patterns by segment, region, and product family using historical order data and macroeconomic indicators.",
  customer_analytics: "Segments customers by price sensitivity, purchase behavior, and lifetime value to enable targeted pricing strategies.",
  anomaly_detection: "Monitors real-time quote and order data to flag unusual pricing patterns, discount outliers, and potential revenue leakage.",
};

const ACCURACY_TREND = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2025, i, 1).toLocaleString("default", { month: "short" }),
  price_optimization: 88 + i * 0.3 + Math.sin(i) * 1.5,
  demand_forecasting: 84 + i * 0.4 + Math.cos(i) * 1.2,
  customer_analytics: 91 + i * 0.2 + Math.sin(i + 1) * 1.0,
  anomaly_detection: 93 + i * 0.15 + Math.cos(i + 2) * 0.8,
}));

const RECENT_INSIGHTS = [
  { model: "Price Optimization", type: "Opportunity", text: "38999/KJB family priced 12% below value in Aerospace & Defense segment — recommend +8% adjustment.", time: "2 hours ago", severity: "high" },
  { model: "Demand Forecasting", type: "Alert", text: "CIR/FRCIR demand expected to increase 18% in Q3 2026 driven by Transportation sector recovery.", time: "4 hours ago", severity: "medium" },
  { model: "Anomaly Detection", type: "Warning", text: "3 quotes for MKJ Trinity parts show discount > 35% — outside approved policy. Review required.", time: "6 hours ago", severity: "high" },
  { model: "Customer Analytics", type: "Insight", text: "Tier 1 aerospace customers show 0.3 price sensitivity — pricing power opportunity of ~$420K annually.", time: "8 hours ago", severity: "low" },
  { model: "Price Optimization", type: "Opportunity", text: "MS Series pricing in Medical segment lags market by 6.4% — value-based repricing could add $180K.", time: "12 hours ago", severity: "medium" },
  { model: "Demand Forecasting", type: "Alert", text: "D-Sub/DPX demand trending down 9% in Industrial — consider promotional pricing to defend volume.", time: "1 day ago", severity: "medium" },
];

export default function AITools() {
  const [, navigate] = useLocation();
  const { data: models = [], isLoading } = trpc.aiTools.getModels.useQuery();

  const handleRetrain = (modelName: string) => {
    toast.success(`Retraining ${modelName} — estimated completion in 15 minutes.`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">AI Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered pricing intelligence models and real-time insights</p>
        </div>
        <Button onClick={() => toast.success("All models refreshed.")} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh All Models
        </Button>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-2 gap-6">
        {(models.length ? models : FALLBACK_MODELS).map((model) => {
          const name = "modelName" in model ? model.modelName : model.name;
          const type = "modelType" in model ? model.modelType : model.type;
          const accuracy = model.accuracy;
          const predictions = "totalPredictions" in model ? model.totalPredictions : (model as typeof FALLBACK_MODELS[0]).predictions;
          const status = model.status;
          const Icon = MODEL_ICONS[type] ?? Brain;
          const color = MODEL_COLORS[type] ?? "#888";
          const description = MODEL_DESCRIPTIONS[type] ?? "";

          return (
            <Card key={name} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{name}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{type.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${
                    status === "Active" ? "bg-emerald-100 text-emerald-700 border-0" :
                    status === "Training" ? "bg-blue-100 text-blue-700 border-0" :
                    "bg-gray-100 text-gray-600 border-0"
                  }`}>
                    {status === "Active" ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <Clock className="w-3 h-3 mr-1 inline" />}
                    {status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Model Accuracy</p>
                    <div className="flex items-center gap-2">
                      <Progress value={accuracy} className="flex-1 h-2" />
                      <span className="text-sm font-bold font-mono" style={{ color }}>{accuracy.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Predictions</p>
                    <p className="text-lg font-bold">{predictions.toLocaleString()}</p>
                  </div>
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ACCURACY_TREND} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey={type} stroke={color} fill={`url(#grad-${type})`} strokeWidth={2} dot={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                      <YAxis domain={[80, 100]} tick={{ fontSize: 9 }} width={28} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleRetrain(name)}>
                  <Zap className="w-3.5 h-3.5" />
                  Retrain Model
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {RECENT_INSIGHTS.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                  insight.severity === "high" ? "bg-red-500" :
                  insight.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{insight.model}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">{insight.type}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{insight.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const FALLBACK_MODELS = [
  { name: "ITT Price Optimizer", type: "price_optimization", accuracy: 91.4, predictions: 48230, status: "Active" },
  { name: "Demand Forecaster", type: "demand_forecasting", accuracy: 87.2, predictions: 32180, status: "Active" },
  { name: "Customer Segmentation AI", type: "customer_analytics", accuracy: 93.8, predictions: 15640, status: "Active" },
  { name: "Revenue Anomaly Detector", type: "anomaly_detection", accuracy: 95.1, predictions: 8920, status: "Active" },
];
