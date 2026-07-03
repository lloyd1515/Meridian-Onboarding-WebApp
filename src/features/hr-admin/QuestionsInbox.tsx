import React, { useEffect, useState } from 'react';
import { answerQuestion, getQuestions, Question } from '../../services/db';

export const QuestionsInbox: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'answered' | 'all'>('open');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadQuestions = async () => {
    setIsLoading(true);
    setQuestions(await getQuestions());
    setIsLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleAnswer = async (questionId: string) => {
    const draft = (drafts[questionId] || '').trim();
    if (!draft) return;

    setError('');
    setSubmittingId(questionId);
    try {
      const updated = await answerQuestion(questionId, draft);
      setQuestions(prev => prev.map(q => (q.id === questionId ? updated : q)));
      setDrafts(prev => ({ ...prev, [questionId]: '' }));
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredQuestions = questions.filter(q => filter === 'all' || q.status === filter);
  const openCount = questions.filter(q => q.status === 'open').length;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">Ask HR Inbox</h2>
        <p className="text-body-sm text-text-muted">
          Questions submitted by employees across the company. {openCount} still open.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-danger text-danger text-caption p-3 rounded-xl font-mono">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {(['open', 'answered', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-caption font-mono uppercase font-bold border transition-colors ${
              filter === f
                ? 'bg-[#0B2A3D] text-white border-[#0B2A3D]'
                : 'border-border bg-white text-text-primary hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="border border-border bg-surface rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
            Loading...
          </div>
        ) : filteredQuestions.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {filteredQuestions.map(q => (
              <div key={q.id} className="p-5 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-body text-[#0B2A3D]">{q.subject}</h4>
                    <span className="text-caption text-text-muted font-mono">
                      {q.employeeName || 'Unknown employee'}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      q.status === 'answered'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-amber-50 text-warning border-warning/20'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>

                <p className="text-body-sm text-text-primary leading-relaxed">{q.body}</p>

                {q.answer ? (
                  <div className="bg-[#0B2A3D]/5 border border-[#0B2A3D]/10 p-3 rounded-xl">
                    <span className="text-[10px] font-mono uppercase text-[#0B2A3D] font-bold tracking-wider">Your Response</span>
                    <p className="text-body-sm text-text-primary leading-relaxed mt-1">{q.answer}</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <textarea
                      rows={2}
                      value={drafts[q.id] || ''}
                      onChange={(e) => setDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Write a response..."
                      className="flex-grow border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent resize-none"
                    />
                    <button
                      onClick={() => handleAnswer(q.id)}
                      disabled={submittingId === q.id || !(drafts[q.id] || '').trim()}
                      className="self-end sm:self-stretch px-5 py-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {submittingId === q.id ? 'Sending...' : 'Answer'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
            No {filter !== 'all' ? filter : ''} questions.
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionsInbox;
