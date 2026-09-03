import { Link, useLocation } from "wouter";
import {
  ShoppingCart, Settings, Menu, X, BarChart2,
  Users, Package, List, FileText, ChevronDown, Target, Plus, ShieldCheck,
  Shield, Activity, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuote } from "@/contexts/QuoteContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const PRICING_MENU = [
  { href: "/analytics", label: "Pricing Analytics", icon: BarChart2, desc: "KPIs, margin bridge, price performance" },
  { href: "/competitive-intelligence", label: "Competitive Intelligence", icon: Target, desc: "Market share, win/loss, positioning" },
  { href: "/margin-causality", label: "Margin Causality", icon: Activity, desc: "Volume drop & lost business signals" },
  { href: "/pricing-rules", label: "Pricing Rules", icon: Shield, desc: "Margin floors, markup, tethering & discount caps" },
];

const MANAGEMENT_MENU = [
  { href: "/customers", label: "Customer Management", icon: Users, desc: "Enterprise accounts & performance" },
  { href: "/products", label: "Product Management", icon: Package, desc: "Standard & custom product catalog" },
  { href: "/price-lists", label: "Price List Management", icon: List, desc: "AI recommendations & approval workflow" },
  { href: "/quote-management", label: "Quote Management", icon: FileText, desc: "Quote pipeline & approval workflow" },
  { href: "/bulk-opportunities", label: "Bulk Opportunities", icon: FileText, desc: "Import and price multi-line SPA opportunities" },
  { href: "/approval-queue", label: "Approval Queue", icon: ShieldCheck, desc: "5-level quote authorization workflow" },
  { href: "/agreements", label: "Customer Agreements", icon: Shield, desc: "Negotiated price floors & ceilings" },
  { href: "/channel-compliance", label: "Channel Compliance", icon: AlertTriangle, desc: "Out-of-band quote monitoring" },
];

function DropdownMenu({
  label,
  items,
  location,
}: {
  label: string;
  items: { href: string; label: string; icon: React.ElementType; desc: string }[];
  location: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = items.some((i) => location.startsWith(i.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150",
          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        {label}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl border border-border/60 shadow-xl shadow-black/5 py-2 z-50">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 hover:bg-accent/60 transition-colors",
                  location.startsWith(item.href) && "bg-primary/5"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5",
                  location.startsWith(item.href) ? "bg-primary/15" : "bg-muted"
                )}>
                  <Icon className={cn("w-4 h-4", location.startsWith(item.href) ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", location.startsWith(item.href) ? "text-primary" : "text-foreground")}>{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const { cartCount, toggleCart } = useQuote();
  const { user } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const coreLinks = [
    { href: "/", label: "Home" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg header-gradient shadow-sm group-hover:shadow-md transition-shadow duration-200">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground">ITT Connectors</span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Smart Pricing Engine</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {coreLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                location === link.href || (link.href !== "/" && location.startsWith(link.href))
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {link.label}
            </Link>
          ))}
          <DropdownMenu label="Pricing" items={PRICING_MENU} location={location} />
          <DropdownMenu label="Management" items={MANAGEMENT_MENU} location={location} />
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link href="/quote-workflow">
            <Button
              size="sm"
              className={cn(
                "gap-1.5 shadow-sm transition-all duration-150",
                location === "/quote-workflow"
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Quote</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCart}
            className="relative gap-2 border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Quote List</span>
            {cartCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            )}
          </Button>

          {user?.role === "admin" && (
            <Link href="/admin">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-2 text-muted-foreground hover:text-foreground",
                  location === "/admin" && "text-primary bg-primary/10"
                )}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-white px-4 py-3 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
          {coreLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === link.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing</p>
          {PRICING_MENU.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.startsWith(link.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {link.label}
            </Link>
          ))}
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Management</p>
          {MANAGEMENT_MENU.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.startsWith(link.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
