import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../LoadingSpinner';

interface WaterfallData {
  list_price: number;
  volume_discount: number;
  contract_discount: number;
  promotional_discount: number;
  invoice_price: number;
  rebates: number;
  payment_terms: number;
  freight: number;
  pocket_price: number;
}

export function PriceWaterfallAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WaterfallData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: waterfallData, error } = await supabase
        .from('analytics_price_waterfall')
        .select('*')
        .is('product_family', null)
        .is('region', null)
        .is('channel', null)
        .is('segment', null)
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setData(waterfallData);
    } catch (error) {
      console.error('Error loading price waterfall:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-slate-600">No data available</div>;
  }

  const components = [
    { label: 'List Price', value: data.list_price, isTotal: true },
    { label: 'Volume Discount', value: -data.volume_discount, isNegative: true },
    { label: 'Contract Discount', value: -data.contract_discount, isNegative: true },
    { label: 'Promotional Discount', value: -data.promotional_discount, isNegative: true },
    { label: 'Invoice Price', value: data.invoice_price, isTotal: true },
    { label: 'Rebates', value: -data.rebates, isNegative: true },
    { label: 'Payment Terms', value: -data.payment_terms, isNegative: true },
    { label: 'Freight', value: -data.freight, isNegative: true },
    { label: 'Pocket Price', value: data.pocket_price, isTotal: true }
  ];

  const maxValue = data.list_price;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Price Waterfall Breakdown
        </h3>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">List Price</div>
            <div className="text-2xl font-bold text-blue-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(data.list_price)}
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-700 mb-1">Invoice Price</div>
            <div className="text-2xl font-bold text-yellow-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(data.invoice_price)}
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {((data.invoice_price / data.list_price) * 100).toFixed(1)}% of list
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Pocket Price</div>
            <div className="text-2xl font-bold text-green-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(data.pocket_price)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {((data.pocket_price / data.list_price) * 100).toFixed(1)}% of list
            </div>
          </div>
        </div>

        <div className="h-96 flex items-end justify-between gap-2">
          {components.map((component, idx) => {
            const height = (Math.abs(component.value) / maxValue) * 100;
            const bgColor = component.isTotal
              ? 'bg-blue-600'
              : component.isNegative
              ? 'bg-red-500'
              : 'bg-green-500';

            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full ${bgColor} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                  style={{ height: `${height}%`, minHeight: '12px' }}
                  title={`${component.label}: ${new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(Math.abs(component.value))}`}
                />
                <div className="mt-3 text-center">
                  <div className="text-xs text-slate-600 mb-1 leading-tight">
                    {component.label}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      notation: 'compact'
                    }).format(Math.abs(component.value))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded" />
            <span className="text-slate-600">Total Values</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span className="text-slate-600">Deductions</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Price Leakage Analysis
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="font-medium text-slate-900">Total Discounts</div>
              <div className="text-sm text-slate-600">Pre-invoice reductions</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0
                }).format(data.volume_discount + data.contract_discount + data.promotional_discount)}
              </div>
              <div className="text-sm text-red-600">
                {(((data.volume_discount + data.contract_discount + data.promotional_discount) / data.list_price) * 100).toFixed(1)}% of list
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="font-medium text-slate-900">Post-Invoice Costs</div>
              <div className="text-sm text-slate-600">Rebates, terms, freight</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0
                }).format(data.rebates + data.payment_terms + data.freight)}
              </div>
              <div className="text-sm text-red-600">
                {(((data.rebates + data.payment_terms + data.freight) / data.invoice_price) * 100).toFixed(1)}% of invoice
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <div className="font-medium text-green-900">Price Realization</div>
              <div className="text-sm text-green-700">Final pocket price vs list</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-900">
                {((data.pocket_price / data.list_price) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-green-700">
                of list price realized
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
