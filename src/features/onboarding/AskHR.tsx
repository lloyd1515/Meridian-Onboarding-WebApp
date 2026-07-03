import React, { useEffect, useState } from 'react';
import { askQuestion, getQuestions, Question } from '../../services/db';

export const AskHR: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadQuestions = async () => {
    setIsLoading(true);
    setQuestions(await getQuestions());
    setIsLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const created = await askQuestion(subject, body);
      setQuestions(prev => [created, ...prev]);
      setSubject('');
      setBody('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit question');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-6">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-text-primary mb-1">Ask HR</h2>
        <p className="text-body-lg text-text-muted">
          Have a question that isn't covered in the Company Guide? Send it to HR and they'll reply here.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border border-border bg-surface p-6 rounded-2xl shadow-sm flex flex-col gap-3.5">
        {error && (
          <div className="bg-red-50 border border-danger text-danger text-caption p-3 rounded-xl font-mono">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-caption uppercase text-text-primary font-bold">Subject</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E.g. Payroll timing"
            className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-caption uppercase text-text-primary font-bold">Question</label>
          <textarea
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask anything about onboarding, benefits, IT, or your first month..."
            className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start flex items-center justify-center gap-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm disabled:opacity-50"
        >
          <span>{isSubmitting ? 'Sending...' : 'Send to HR'}</span>
        </button>
      </form>

      <div className="border border-border bg-surface rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-[#E9F1F3] border-b border-border px-6 py-3">
          <h3 className="font-mono text-caption uppercase tracking-wider font-bold text-[#0B2A3D]">Your Questions</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
            Loading...
          </div>
        ) : questions.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {questions.map(q => (
              <div key={q.id} className="p-5 flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-body text-text-primary">{q.subject}</h4>
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      q.status === 'answered'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-slate-100 text-text-muted border-border'
                    }`}
                  >
                    {q.status}
                  </span>
                </div>
                <p className="text-body-sm text-text-muted leading-relaxed">{q.body}</p>
                {q.answer && (
                  <div className="mt-1 bg-[#0B2A3D]/5 border border-[#0B2A3D]/10 p-3 rounded-xl">
                    <span className="text-[10px] font-mono uppercase text-[#0B2A3D] font-bold tracking-wider">HR Response</span>
                    <p className="text-body-sm text-text-primary leading-relaxed mt-1">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
            You haven't asked anything yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default AskHR;
