import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCases, fetchCase, createTrial, type CaseDetail } from '../api/client';

export function HomePage() {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cases = await fetchCases();
        if (cases.length === 0) throw new Error('No cases available');
        const full = await fetchCase(cases[0].slug);
        setDetail(full);
        setJudgeId(full.judges[0]?.id ?? null);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  async function beginTrial() {
    if (!detail || !judgeId) return;
    setStarting(true);
    try {
      const { trialId } = await createTrial(detail.case.id, judgeId);
      navigate(`/trial/${trialId}`);
    } catch (err) {
      setError((err as Error).message);
      setStarting(false);
    }
  }

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!detail) return <div className="p-8 text-stone-100">Loading case…</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-serif mb-2">{detail.case.title}</h1>
      <p className="text-stone-400 mb-6">{detail.case.act_alleged}</p>
      <div className="mb-8 whitespace-pre-wrap text-stone-300">{detail.case.question_md}</div>

      <h2 className="text-xl font-serif mb-3">Choose a judge</h2>
      <div className="space-y-2 mb-8">
        {detail.judges.map((judge) => (
          <label
            key={judge.id}
            className="flex items-start gap-3 p-3 rounded border border-stone-800 cursor-pointer"
          >
            <input
              type="radio"
              name="judge"
              checked={judgeId === judge.id}
              onChange={() => setJudgeId(judge.id)}
            />
            <span>
              <span className="block font-medium">{judge.name}</span>
              <span className="block text-sm text-stone-400">{judge.description}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={beginTrial}
        disabled={starting}
        className="px-6 py-3 bg-amber-800 hover:bg-amber-700 rounded font-serif text-lg disabled:opacity-50"
      >
        {starting ? 'Convening…' : 'Begin Trial'}
      </button>
    </div>
  );
}
