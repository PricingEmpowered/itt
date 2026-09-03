import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  TrendingDown, BarChart3, Filter,
} from "lucide-react";

const CHANNELS = ["OEM", "Distribution", "Intercompany"];
const VIOLATION_LABELS: Record<string, { label: string; color: string }> = {
  below_floor: { label: "Below Floor", color: "bg-red-100 text-red-700 border-red-200" },
  above_ceiling: { label: "Above Ceiling", color: "bg-amber-100 text-amber-700 border-amber-200" },
  no_agreement: { label: "No Agreement", color: "bg-slate-100 text-slate-600 border-slate-200" },
  compliant: { label: "Compliant", color: "bg-green-100 text-green-700 border-green-200" },
};

export default function ChannelCompliance() {
  const [, navigate] = useLocation();
  const [channelFilter, setChannelFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("90");

  const { data: summary } = trpc.compliance.getSummary.useQuery();
  const { data: events = [], isLoading } = trpc.compliance.getReport.useQuery({
    channel: channelFilter !== "all" ? channelFilter : undefined,
    compliant: complianceFilter === "violations" ? false : complianceFilter === "compliant" ? true : undefined,
    days: parseInt(daysFilter),
    limit: 200,
  });

  const violations = events.filter(e => !e.compliant);
  const compliantCount = events.filter(e => e.compliant).length;
  const complianceRate = events.length > 0 ? Math.round((compliantCount / events.length) * 100) : 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <div className="container py-8 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Channel Price Compliance</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Monitor whether quotes are within authorised price bands for each channel and customer agreement. Violations flag quotes priced below the floor or above the ceiling of an active agreement.
        </p>

        {/* KPI bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Overall Compliance</span>
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-green-600">{summary?.complianceRate ?? complianceRate}%</div>
            <Progress value={summary?.complianceRate ?? complianceRate} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Events</span>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{summary?.totalEvents ?? events.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 border-red-200 bg-red-50/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Violations</span>
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{summary?.violations ?? violations.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Channels Monitored</span>
              <Filter className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{summary?.byChannel?.length ?? 3}</div>
          </div>
        </div>

        {/* Channel breakdown */}
        {summary?.byChannel && summary.byChannel.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {summary.byChannel.map(ch => (
              <div key={ch.channel} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{ch.channel}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ch.complianceRate >= 95 ? "bg-green-100 text-green-700" :
                    ch.complianceRate >= 80 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{ch.complianceRate}%</span>
                </div>
                <Progress value={ch.complianceRate} className="h-1.5 mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{ch.total} events</span>
                  <span className="text-red-600">{ch.violations} violations</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="violations">Violations Only</SelectItem>
              <SelectItem value="compliant">Compliant Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{events.length} events</span>
        </div>

        {/* Events table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead className="text-right">List Price</TableHead>
                  <TableHead className="text-right">Quoted Price</TableHead>
                  <TableHead className="text-right">Discount %</TableHead>
                  <TableHead className="text-right">Auth. Floor</TableHead>
                  <TableHead className="text-right">Auth. Ceiling</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading compliance data…</TableCell></TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12">
                      <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground font-medium text-sm">No compliance events found</p>
                      <p className="text-xs text-muted-foreground mt-1">Compliance events are recorded automatically when quotes are submitted</p>
                    </TableCell>
                  </TableRow>
                ) : events.map((e) => {
                  const vt = e.violationType ?? "compliant";
                  const vtStyle = VIOLATION_LABELS[vt] ?? VIOLATION_LABELS.compliant;
                  const quotedPrice = parseFloat(String(e.quotedPrice));
                  const listPrice = e.listPrice ? parseFloat(String(e.listPrice)) : null;
                  const floorPrice = e.authorisedFloor ? parseFloat(String(e.authorisedFloor)) : null;
                  const ceilPrice = e.authorisedCeiling ? parseFloat(String(e.authorisedCeiling)) : null;
                  return (
                    <TableRow key={e.id} className={!e.compliant ? "bg-red-50/30" : ""}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(e.quoteDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[140px] truncate">{e.customerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{e.channel}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.partNumber}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.productFamily ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{listPrice ? `$${listPrice.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-semibold ${!e.compliant ? "text-red-600" : ""}`}>
                        ${quotedPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${
                        e.discountPct != null && e.discountPct > 20 ? "text-red-600" : "text-foreground"
                      }`}>
                        {e.discountPct != null ? `${e.discountPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {floorPrice ? `$${floorPrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {ceilPrice ? `$${ceilPrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${vtStyle.color}`}>
                          {e.compliant ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                          {vtStyle.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
