'use client';

import React, { useState, useEffect } from 'react';

// Define types for our quiz data for better type-safety
interface QuizStep {
  question: string;
  options?: { value: string; label: string; impact: string; }[];
  slider?: { min: number; max: number; };
  guidance?: Record<string, string>;
}

interface StrategyQuiz {
  id: string;
  title: string;
  steps: QuizStep[];
}

const StrategyBuilderPage = () => {
  const [quiz, setQuiz] = useState<StrategyQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({
    goal: 'income',
    volatility: 5,
    timeline: 'medium'
  });
  const [personalizedStrategy, setPersonalizedStrategy] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch the quiz structure from the backend API
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/quizzes/build-your-strategy`);
        if (!response.ok) {
          throw new Error('Failed to fetch quiz data.');
        }
        const data = await response.json();
        setQuiz(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [API_BASE_URL]);

  const handleInputChange = (stepQuestion: string, value: any) => {
    // Map question to the state key
    const key = stepQuestion.includes('goal') ? 'goal' : stepQuestion.includes('volatility') ? 'volatility' : 'timeline';
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPersonalizedStrategy('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/quizzes/generate-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (!response.ok) {
        throw new Error('Failed to generate strategy.');
      }
      const result = await response.json();
      setPersonalizedStrategy(result.personalizedStrategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !quiz) {
    return <div className="text-center p-8">Loading Strategy Builder...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{quiz?.title}</h1>
      <p className="text-gray-600 mb-6">Answer the questions to get a personalized investment strategy.</p>
      
      <form onSubmit={handleSubmit}>
        {quiz?.steps.map((step, index) => (
          <div key={index} className="mb-8">
            <label className="block text-xl font-semibold text-gray-700 mb-3">{step.question}</label>
            {step.options && (
              <div className="space-y-2">
                {step.options.map(option => (
                  <div key={option.value}>
                    <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name={`step-${index}`}
                        value={option.value}
                        checked={answers[Object.keys(answers)[index]] === option.value}
                        onChange={(e) => handleInputChange(step.question, e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-gray-700">{option.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
            {step.slider && (
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min={step.slider.min}
                  max={step.slider.max}
                  value={answers.volatility}
                  onChange={(e) => handleInputChange(step.question, parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-bold text-lg text-blue-600">{answers.volatility}</span>
              </div>
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate My Strategy'}
        </button>
      </form>

      {personalizedStrategy && (
        <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Personalized Strategy</h2>
          <pre className="text-gray-700 whitespace-pre-wrap font-sans">{personalizedStrategy}</pre>
        </div>
      )}
    </div>
  );
};

export default StrategyBuilderPage; 