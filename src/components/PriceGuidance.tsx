import { useState, useEffect } from 'react';
import { db } from '../lib/dataClient';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface PriceGuidanceProps {
  productId: string;
  unitPrice: number;
  discount: number;
  customerId: string;
}

interface PeerPrice {
  customer_name: string;
  customer_segment: string;
  unit_price: number;
  quantity: number;
  quote_date: string;
}

export function PriceGuidance({ productId, unitPrice, discount, customerId }: PriceGuidanceProps) {
  const [peerPrices, setPeerPrices] = useState<PeerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    percentile: 0,
  });

  useEffect(() => {
    if (productId) {
      loadPriceGuidance();
    }
  }, [productId, customerId]);

  const loadPriceGuidance = async () => {
    try {
      setLoading(true);

      let currentCustomerSegment = null;
      if (customerId) {
        const { data: currentCustomer } = await db
          .from('customers')
          .select('segment')
          .eq('id', customerId)
          .maybeSingle();
        currentCustomerSegment = currentCustomer?.segment;
      }

      const { data: quoteLines, error: queryError } = await db
        .from('quote_lines')
        .select(`
          unit_price,
          quantity,
          quotes!inner(
            created_at,
            status,
            customers!inner(
              name,
              segment
            )
          )
        `)
        .eq('product_id', productId)
        .in('quotes.status', ['Approved', 'Rejected']);

      if (queryError) {
        console.error('Query error:', queryError);
        setPeerPrices([]);
        setLoading(false);
        return;
      }

      if (quoteLines && quoteLines.length > 0) {
        const peerData: PeerPrice[] = quoteLines.map((line: any) => ({
          customer_name: line.quotes.customers.name,
          customer_segment: line.quotes.customers.segment,
          unit_price: parseFloat(line.unit_price),
          quantity: line.quantity,
          quote_date: line.quotes.created_at,
        }));

        let relevantPrices = peerData;
        if (currentCustomerSegment) {
          const sameTierPrices = peerData.filter(
            (p) => p.customer_segment === currentCustomerSegment
          );
          relevantPrices = sameTierPrices.length >= 3 ? sameTierPrices : peerData;
        }

        const prices = relevantPrices.map((p) => p.unit_price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        const effectivePrice = unitPrice * (1 - discount / 100);
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const belowCount = sortedPrices.filter((p) => p < effectivePrice).length;
        const percentile = (belowCount / sortedPrices.length) * 100;

        setStats({
          avgPrice,
          minPrice,
          maxPrice,
          percentile,
        });

        setPeerPrices(relevantPrices.slice(0, 5));
      } else {
        setPeerPrices([]);
      }
    } catch (error) {
      console.error('Error loading price guidance:', error);
      setPeerPrices([]);
    } finally {
      setLoading(false);
    }
  };

  if (!productId) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <div className="text-sm text-slate-500">Loading price guidance...</div>
      </div>
    );
  }

  if (peerPrices.length === 0) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-medium text-amber-900">No Historical Data</p>
            <p className="text-xs text-amber-700 mt-1">
              No previous quotes found for this product. Consider using market pricing or cost-plus methodology.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const effectivePrice = unitPrice * (1 - discount / 100);
  const priceVsAvg = ((effectivePrice - stats.avgPrice) / stats.avgPrice) * 100;
  const isAboveAvg = effectivePrice > stats.avgPrice;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Price Guidance</h4>
        <div className="flex items-center gap-2">
          {isAboveAvg ? (
            <TrendingUp className="text-red-500" size={16} />
          ) : (
            <TrendingDown className="text-emerald-500" size={16} />
          )}
          <span
            className={`text-xs font-semibold ${
              isAboveAvg ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {priceVsAvg > 0 ? '+' : ''}
            {priceVsAvg.toFixed(1)}% vs avg
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-600 mb-1">Your Price</div>
          <div className="text-lg font-bold text-slate-900">
            ${effectivePrice.toFixed(2)}
          </div>
          {discount > 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              ({discount}% off ${unitPrice.toFixed(2)})
            </div>
          )}
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-700 mb-1">Avg Price</div>
          <div className="text-lg font-bold text-blue-900">
            ${stats.avgPrice.toFixed(2)}
          </div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-xs text-emerald-700 mb-1">Min Price</div>
          <div className="text-lg font-bold text-emerald-900">
            ${stats.minPrice.toFixed(2)}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-xs text-red-700 mb-1">Max Price</div>
          <div className="text-lg font-bold text-red-900">
            ${stats.maxPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-700">
            Your price is at the {stats.percentile.toFixed(0)}th percentile
          </span>
          <span className="text-xs text-slate-500">
            {peerPrices.length} comparable quotes
          </span>
        </div>
        <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-red-500"
            style={{ width: '100%' }}
          />
          <div
            className="absolute top-0 w-1 h-full bg-slate-900"
            style={{ left: `${stats.percentile}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Most competitive</span>
          <span>Least competitive</span>
        </div>
      </div>

      <div>
        <h5 className="text-xs font-medium text-slate-700 mb-2">Recent Peer Quotes</h5>
        <div className="space-y-1">
          {peerPrices.map((peer, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 rounded"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{peer.customer_name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-600">{peer.customer_segment}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-600">{peer.quantity}x units</span>
                <span className="font-semibold text-slate-900">
                  ${peer.unit_price.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
