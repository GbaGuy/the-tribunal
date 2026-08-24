import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCases, fetchCase, createTrial, type CaseDetail } from '../api/client';

export function HomePage() {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [defensePanelJudgeId, setDefensePanelJudgeId] = useState<string | null>(null);
  const [prosecutionPanelJudgeId, setProsecutionPanelJudgeId] = useState<string | null>(null);
  const [finalJudgeId, setFinalJudgeId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cases = await fetchCases();
        if (cases.length === 0) throw new Error('No cases available');
        const full = await fetchCase(cases[0].slug);
        setDetail(full);
        setDefensePanelJudgeId(full.judges[0]?.id ?? null);
        setProsecutionPanelJudgeId(full.judges[1]?.id ?? null);
        setFinalJudgeId(full.judges[2]?.id ?? null);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  const rolesDistinct =
    !!defensePanelJudgeId &&
    !!prosecutionPanelJudgeId &&
    !!finalJudgeId &&
    new Set([defensePanelJudgeId, prosecutionPanelJudgeId, finalJudgeId]).size === 3;

  async function beginTrial() {
    if (!detail || !rolesDistinct) return;
    setStarting(true);
    try {
      const { trialId } = await createTrial(
        detail.case.id,
        defensePanelJudgeId!,
        prosecutionPanelJudgeId!,
        finalJudgeId!
      );
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

      <h2 className="text-xl font-serif mb-3">Assign the bench</h2>
      <p className="text-sm text-stone-400 mb-4">
        The defense panel judge reviews only the defense testimony; the prosecution panel judge reviews
        only the prosecution testimony. The final judge then reads all four character responses, both
        panel opinions, and renders the verdict.
      </p>
      <div className="space-y-4 mb-8">
        <JudgeSelect
          label="Defense Panel Judge"
          judges={detail.judges}
          value={defensePanelJudgeId}
          onChange={setDefensePanelJudgeId}
        />
        <JudgeSelect
          label="Prosecution Panel Judge"
          judges={detail.judges}
          value={prosecutionPanelJudgeId}
          onChange={setProsecutionPanelJudgeId}
        />
        <JudgeSelect label="Final Judge" judges={detail.judges} value={finalJudgeId} onChange={setFinalJudgeId} />
        {!rolesDistinct && (
          <p className="text-sm text-red-400">Each judge must be assigned to a different role.</p>
        )}
      </div>

      <button
        onClick={beginTrial}
        disabled={starting || !rolesDistinct}
        className="px-6 py-3 bg-amber-800 hover:bg-amber-700 rounded font-serif text-lg disabled:opacity-50"
      >
        {starting ? 'Convening…' : 'Begin Trial'}
      </button>
    </div>
  );
}

function JudgeSelect({
  label,
  judges,
  value,
  onChange,
}: {
  label: string;
  judges: CaseDetail['judges'];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <select
        className="w-full bg-stone-900 border border-stone-800 rounded p-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select a judge…
        </option>
        {judges.map((judge) => (
          <option key={judge.id} value={judge.id}>
            {judge.name}
          </option>
        ))}
      </select>
    </label>
  );
}
