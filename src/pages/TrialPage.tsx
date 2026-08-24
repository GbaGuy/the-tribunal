import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchTrial,
  fetchCase,
  fetchModels,
  respondAs,
  opineAsJudge,
  requestVerdict,
  setPersonaModel,
  type CaseDetail,
  type ModelOption,
} from '../api/client';
import { CharacterCard } from '../components/CharacterCard';
import { JudgeCard } from '../components/JudgeCard';
import type { CardState } from '../components/cardTypes';

export function TrialPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [defensePanelJudgeId, setDefensePanelJudgeId] = useState<string | null>(null);
  const [prosecutionPanelJudgeId, setProsecutionPanelJudgeId] = useState<string | null>(null);
  const [finalJudgeId, setFinalJudgeId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [panelStates, setPanelStates] = useState<Record<string, CardState>>({});
  const [verdict, setVerdict] = useState<CardState>({ status: 'pending' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  async function runCharacter(personaId: string) {
    setCardStates((prev) => ({ ...prev, [personaId]: { status: 'loading' } }));
    try {
      const response = await respondAs(trialId!, personaId);
      if (cancelledRef.current) return;
      setCardStates((prev) => ({
        ...prev,
        [personaId]: { status: 'done', content: response.content ?? undefined },
      }));
    } catch (err) {
      if (cancelledRef.current) return;
      setCardStates((prev) => ({
        ...prev,
        [personaId]: { status: 'error', error: (err as Error).message },
      }));
    }
  }

  async function runPanelJudge(judgeId: string) {
    setPanelStates((prev) => ({ ...prev, [judgeId]: { status: 'loading' } }));
    try {
      const response = await opineAsJudge(trialId!, judgeId);
      if (cancelledRef.current) return;
      setPanelStates((prev) => ({
        ...prev,
        [judgeId]: { status: 'done', content: response.content ?? undefined },
      }));
    } catch (err) {
      if (cancelledRef.current) return;
      setPanelStates((prev) => ({
        ...prev,
        [judgeId]: { status: 'error', error: (err as Error).message },
      }));
    }
  }

  async function runVerdict() {
    setVerdict({ status: 'loading' });
    try {
      const response = await requestVerdict(trialId!);
      if (cancelledRef.current) return;
      setVerdict({ status: 'done', content: response.content ?? undefined });
    } catch (err) {
      if (cancelledRef.current) return;
      setVerdict({ status: 'error', error: (err as Error).message });
    }
  }

  useEffect(() => {
    if (!trialId) return;
    cancelledRef.current = false;

    async function run() {
      try {
        const [trialData, models] = await Promise.all([fetchTrial(trialId!), fetchModels()]);
        const detail = await fetchCase(trialData.case.slug);
        if (cancelledRef.current) return;
        setCaseDetail(detail);
        setDefensePanelJudgeId(trialData.trial.defense_panel_judge_id);
        setProsecutionPanelJudgeId(trialData.trial.prosecution_panel_judge_id);
        setFinalJudgeId(trialData.trial.judge_persona_id);
        setModelOptions(models);

        // trialData.responses is ordered by created_at ascending, so a Map keyed
        // by persona_id naturally ends up holding each persona's latest banked response.
        const existingByPersona = new Map(trialData.responses.map((r) => [r.persona_id, r]));

        const initialCardStates: Record<string, CardState> = {};
        for (const character of detail.characters) {
          const existing = existingByPersona.get(character.id);
          initialCardStates[character.id] = existing
            ? existing.error
              ? { status: 'error', error: existing.error }
              : { status: 'done', content: existing.content ?? undefined }
            : { status: 'loading' };
        }
        setCardStates(initialCardStates);

        const panelIds = [trialData.trial.defense_panel_judge_id, trialData.trial.prosecution_panel_judge_id];
        const initialPanelStates: Record<string, CardState> = {};
        for (const judgeId of panelIds) {
          const existing = existingByPersona.get(judgeId);
          initialPanelStates[judgeId] = existing
            ? existing.error
              ? { status: 'error', error: existing.error }
              : { status: 'done', content: existing.content ?? undefined }
            : { status: 'pending' };
        }
        setPanelStates(initialPanelStates);

        await Promise.all(
          detail.characters
            .filter((character) => !existingByPersona.has(character.id))
            .map((character) => runCharacter(character.id))
        );

        if (cancelledRef.current) return;

        await Promise.all(
          panelIds.filter((judgeId) => !existingByPersona.has(judgeId)).map((judgeId) => runPanelJudge(judgeId))
        );

        if (cancelledRef.current) return;

        const existingVerdict = existingByPersona.get(trialData.trial.judge_persona_id);
        if (existingVerdict) {
          setVerdict(
            existingVerdict.error
              ? { status: 'error', error: existingVerdict.error }
              : { status: 'done', content: existingVerdict.content ?? undefined }
          );
        } else {
          await runVerdict();
        }
      } catch (err) {
        if (!cancelledRef.current) setLoadError((err as Error).message);
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [trialId]);

  async function handleChangeModel(personaId: string, modelId: string) {
    try {
      const updated = await setPersonaModel(personaId, modelId);
      setCaseDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          characters: prev.characters.map((c) =>
            c.id === personaId ? { ...c, model: updated.model, modelId: updated.modelId } : c
          ),
          judges: prev.judges.map((j) =>
            j.id === personaId ? { ...j, model: updated.model, modelId: updated.modelId } : j
          ),
        };
      });
    } catch (err) {
      window.alert(`Failed to change model: ${(err as Error).message}`);
    }
  }

  if (loadError) return <div className="p-8 text-red-400">{loadError}</div>;
  if (!caseDetail) return <div className="p-8 text-stone-100">Loading trial…</div>;

  const defenseJudge = caseDetail.judges.find((j) => j.id === defensePanelJudgeId);
  const prosecutionJudge = caseDetail.judges.find((j) => j.id === prosecutionPanelJudgeId);
  const finalJudge = caseDetail.judges.find((j) => j.id === finalJudgeId);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif mb-6">{caseDetail.case.title}</h1>
      <div className="mb-6 whitespace-pre-wrap text-stone-300 text-sm">{caseDetail.case.facts_md}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {caseDetail.characters.map((character) => (
          <CharacterCard
            key={character.id}
            persona={character}
            state={cardStates[character.id] ?? { status: 'pending' }}
            modelOptions={modelOptions}
            onChangeModel={(modelId) => handleChangeModel(character.id, modelId)}
            onRetry={() => runCharacter(character.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { judge: defenseJudge, roleLabel: 'Defense Panel Judge' },
          { judge: prosecutionJudge, roleLabel: 'Prosecution Panel Judge' },
        ].map(
          ({ judge, roleLabel }) =>
            judge && (
              <JudgeCard
                key={judge.id}
                persona={judge}
                state={panelStates[judge.id] ?? { status: 'pending' }}
                modelOptions={modelOptions}
                onChangeModel={(modelId) => handleChangeModel(judge.id, modelId)}
                onRetry={() => runPanelJudge(judge.id)}
                roleLabel={roleLabel}
              />
            )
        )}
      </div>

      {finalJudge && (
        <JudgeCard
          persona={finalJudge}
          state={verdict}
          modelOptions={modelOptions}
          onChangeModel={(modelId) => handleChangeModel(finalJudge.id, modelId)}
          onRetry={runVerdict}
          roleLabel="Final Judge"
        />
      )}
    </div>
  );
}
