import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchTrial, fetchCase, respondAs, requestVerdict, type CaseDetail, type ResponseRow } from '../api/client';
import { CharacterCard } from '../components/CharacterCard';
import { JudgeCard } from '../components/JudgeCard';
import type { CardState } from '../components/cardTypes';

export function TrialPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [judgePersonaId, setJudgePersonaId] = useState<string | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [verdict, setVerdict] = useState<CardState>({ status: 'pending' });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!trialId) return;
    let cancelled = false;

    async function run() {
      try {
        const trialData = await fetchTrial(trialId!);
        const detail = await fetchCase(trialData.case.slug);
        if (cancelled) return;
        setCaseDetail(detail);
        setJudgePersonaId(trialData.trial.judge_persona_id);

        const existingByPersona = new Map(trialData.responses.map((r) => [r.persona_id, r]));

        const initialStates: Record<string, CardState> = {};
        for (const character of detail.characters) {
          const existing = existingByPersona.get(character.id);
          initialStates[character.id] = existing
            ? existing.error
              ? { status: 'error', error: existing.error }
              : { status: 'done', content: existing.content ?? undefined }
            : { status: 'loading' };
        }
        setCardStates(initialStates);

        await Promise.all(
          detail.characters.map(async (character) => {
            if (existingByPersona.has(character.id)) return;
            try {
              const response = await respondAs(trialId!, character.id);
              if (cancelled) return;
              setCardStates((prev) => ({
                ...prev,
                [character.id]: { status: 'done', content: response.content ?? undefined },
              }));
            } catch (err) {
              if (cancelled) return;
              setCardStates((prev) => ({
                ...prev,
                [character.id]: { status: 'error', error: (err as Error).message },
              }));
            }
          })
        );

        if (cancelled) return;

        const existingVerdict = trialData.responses.find((r: ResponseRow) => r.role === 'judge');
        if (existingVerdict) {
          setVerdict(
            existingVerdict.error
              ? { status: 'error', error: existingVerdict.error }
              : { status: 'done', content: existingVerdict.content ?? undefined }
          );
        } else {
          setVerdict({ status: 'loading' });
          try {
            const response = await requestVerdict(trialId!);
            if (cancelled) return;
            setVerdict({ status: 'done', content: response.content ?? undefined });
          } catch (err) {
            if (cancelled) return;
            setVerdict({ status: 'error', error: (err as Error).message });
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [trialId]);

  if (loadError) return <div className="p-8 text-red-400">{loadError}</div>;
  if (!caseDetail) return <div className="p-8 text-stone-100">Loading trial…</div>;

  const judge = caseDetail.judges.find((j) => j.id === judgePersonaId);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif mb-6">{caseDetail.case.title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {caseDetail.characters.map((character) => (
          <CharacterCard
            key={character.id}
            persona={character}
            state={cardStates[character.id] ?? { status: 'pending' }}
          />
        ))}
      </div>
      {judge && <JudgeCard persona={judge} state={verdict} />}
    </div>
  );
}
