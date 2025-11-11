import { useState, useEffect } from 'react';
import { BookOpen, Play, Plus, Trash2, Edit2, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Question {
  id: string;
  category: string;
  question: string;
  expected_sql: string;
  description: string;
  difficulty: string;
  views_used: string[];
  is_active: boolean;
  created_at: string;
}

interface TestResult {
  question_id: string;
  success: boolean;
  generated_sql: string;
  error?: string;
}

export function AIQuestionLibrary() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [testing, setTesting] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const categories = ['all', 'customer', 'product', 'pricing', 'time_series', 'regional', 'general'];
  const difficulties = ['all', 'easy', 'medium', 'hard'];

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_analytics_questions')
        .select('*')
        .order('category', { ascending: true })
        .order('difficulty', { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const testQuestion = async (question: Question) => {
    setTesting(question.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analytics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: question.question,
            provider: 'openai',
          }),
        }
      );

      const data = await response.json();

      const result: TestResult = {
        question_id: question.id,
        success: response.ok,
        generated_sql: data.sql || data.generated_sql || '',
        error: data.error || data.details,
      };

      setTestResults(prev => new Map(prev).set(question.id, result));
    } catch (error) {
      setTestResults(prev => new Map(prev).set(question.id, {
        question_id: question.id,
        success: false,
        generated_sql: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setTesting(null);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase
        .from('ai_analytics_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_analytics_questions')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;
      await loadQuestions();
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
    if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-100 text-emerald-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      customer: 'bg-blue-100 text-blue-800',
      product: 'bg-purple-100 text-purple-800',
      pricing: 'bg-green-100 text-green-800',
      time_series: 'bg-orange-100 text-orange-800',
      regional: 'bg-pink-100 text-pink-800',
      general: 'bg-slate-100 text-slate-800',
    };
    return colors[category] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Question Library</h1>
            <p className="text-sm text-slate-600">Test and manage AI analytics questions</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Question</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <div className="flex-1 flex items-center space-x-4">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            Showing {filteredQuestions.length} of {questions.length} questions
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredQuestions.map(question => {
          const result = testResults.get(question.id);

          return (
            <div key={question.id} className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(question.category)}`}>
                        {question.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(question.difficulty)}`}>
                        {question.difficulty}
                      </span>
                      {!question.is_active && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium text-slate-900 mb-1">{question.question}</p>
                    {question.description && (
                      <p className="text-sm text-slate-600">{question.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => testQuestion(question)}
                      disabled={testing === question.id}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Test question"
                    >
                      <Play className={`h-4 w-4 ${testing === question.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => toggleActive(question.id, question.is_active)}
                      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      title={question.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <CheckCircle className={`h-4 w-4 ${question.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </button>
                    <button
                      onClick={() => deleteQuestion(question.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-slate-700 mb-1">Expected SQL:</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap">
                    {question.expected_sql}
                  </pre>
                </div>

                {question.views_used.length > 0 && (
                  <div className="flex items-center space-x-2 text-xs text-slate-600">
                    <span className="font-medium">Views:</span>
                    {question.views_used.map(view => (
                      <span key={view} className="px-2 py-1 bg-slate-100 rounded">
                        {view}
                      </span>
                    ))}
                  </div>
                )}

                {result && (
                  <div className={`mt-3 p-3 rounded-lg ${result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-start space-x-2">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium mb-1 ${result.success ? 'text-emerald-900' : 'text-red-900'}`}>
                          {result.success ? 'Query generated successfully' : 'Query generation failed'}
                        </p>
                        {result.error && (
                          <p className="text-sm text-red-700 mb-2">{result.error}</p>
                        )}
                        {result.generated_sql && (
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Generated SQL:</p>
                            <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap">
                              {result.generated_sql}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No questions found matching your filters</p>
        </div>
      )}
    </div>
  );
}
