import { useState } from 'react';
import { Brain, Send, Download, AlertCircle, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface QueryResult {
  success: boolean;
  question: string;
  sql: string;
  results: any[];
  row_count: number;
  error?: string;
  details?: string;
}

const EXAMPLE_QUESTIONS = [
  "Show top 10 customers by revenue",
  "What's the win rate for Enterprise segment customers?",
  "Which product families generate the most revenue?",
  "Show monthly revenue trends for the last 12 months",
  "Compare performance across all regions",
  "What's the average deal size by quarter this year?",
  "Which sales reps have the fastest quote turnaround time?",
  "Show pricing trends for Valves over the last 6 months",
];

export function AIAnalytics() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<QueryResult[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai-analytics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          question: question.trim(),
          sql: data.sql || data.generated_sql || '',
          results: [],
          row_count: 0,
          error: data.error || 'Query failed',
          details: data.details || data.message,
        });
      } else {
        setResult(data);
        setHistory(prev => [data, ...prev].slice(0, 10));
      }
    } catch (error) {
      setResult({
        success: false,
        question: question.trim(),
        sql: '',
        results: [],
        row_count: 0,
        error: 'Request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[]) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined ? '' : String(value);
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const useExample = (example: string) => {
    setQuestion(example);
  };

  const capabilities = trpc.system.capabilities.useQuery();

  /*
   * This deployment may have no language model available (an air-gapped
   * server has none). Say so plainly rather than presenting an input that
   * cannot work.
   */
  if (capabilities.data && !capabilities.data.aiAnalytics) {
    return (
      <div className="space-y-6 fade-in">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Brain className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Ask AI is not available in this deployment
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Natural-language analytics needs a language model the server can reach,
            and this installation does not have one configured. The Analytics,
            Deal Score and Pricing Excellence sections read the same data and are
            fully available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Analytics Assistant</h1>
            <p className="text-sm text-slate-600">Ask questions about your pricing and quote data in natural language</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Sparkles className="h-5 w-5 text-violet-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Secure & Private</h3>
            <p className="text-sm text-slate-700 mb-3">
              All queries run against anonymized data views. Customer names, user identities, and sensitive information are hashed for privacy.
              Only aggregated metrics and anonymized identifiers are accessible.
            </p>
            <div className="flex items-center space-x-4 text-xs text-slate-600">
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Anonymized data</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Read-only access</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Result limits enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Ask a Question</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., What are the top 5 products by revenue in the last quarter?"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-h-[24px]">
                {loading && (
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>Generating query...</span>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Ask AI</span>
              </button>
            </div>
          </form>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700 mb-2">Example questions:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => useExample(example)}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {result && (
          <div className="p-6 space-y-4">
            {result.success ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium text-slate-900">
                      Query successful - {result.row_count} {result.row_count === 1 ? 'row' : 'rows'} returned
                    </span>
                  </div>
                  {result.results.length > 0 && (
                    <button
                      onClick={() => exportToCSV(result.results)}
                      className="px-3 py-1 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-700 mb-2">Generated SQL:</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto">
                    {result.sql}
                  </pre>
                </div>

                {result.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          {Object.keys(result.results[0]).map((key) => (
                            <th
                              key={key}
                              className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider"
                            >
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {result.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {Object.values(row).map((value: any, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                                {value === null || value === undefined
                                  ? '-'
                                  : typeof value === 'number'
                                  ? value.toLocaleString()
                                  : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-600">
                    <p>No results found</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 mb-1">{result.error}</p>
                    {result.details && (
                      <p className="text-sm text-red-700">{result.details}</p>
                    )}
                    {result.sql && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-red-800 mb-1">Generated SQL:</p>
                        <pre className="text-xs text-red-700 overflow-x-auto">
                          {result.sql}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Queries</h2>
          <div className="space-y-2">
            {history.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setQuestion(item.question)}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">{item.question}</span>
                  <span className="text-xs text-slate-600">{item.row_count} rows</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
