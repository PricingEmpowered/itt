import { Currency } from '../types';

export async function fetchExchangeRates(baseCurrency: string = 'USD', targetCurrencies?: string[]): Promise<Record<string, number>> {
  try {
    const apiUrl = `/api/currency-rates?base=${baseCurrency}${targetCurrencies ? `&symbols=${targetCurrencies.join(',')}` : ''}`;

    const response = await fetch(apiUrl, { credentials: 'include' });

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch exchange rates');
    }

    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return {};
  }
}

export function convertAmount(amount: number, rate: number): number {
  return amount * rate;
}

export function formatCurrencyAmount(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyWithSymbol(amount: number, symbol: string, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${symbol}${amount.toFixed(2)}`;
  }
}
