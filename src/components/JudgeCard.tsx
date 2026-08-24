import type { CardState, PersonaCardInfo } from './cardTypes';
import type { ModelOption } from '../api/client';

export function JudgeCard({
  persona,
  state,
  modelOptions,
  onChangeModel,
  onRetry,
  roleLabel,
}: {
  persona: PersonaCardInfo;
  state: CardState;
  modelOptions: ModelOption[];
  onChangeModel: (modelId: string) => void;
  onRetry: () => void;
  roleLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-700 bg-stone-900 p-6">
      {roleLabel && (
        <span className="text-xs uppercase tracking-wide text-amber-500">{roleLabel}</span>
      )}
      <h2 className="text-xl font-serif mb-1">{persona.name}</h2>
      <p className="text-sm text-stone-400 mb-1">{persona.description}</p>
      <select
        className="text-xs font-mono bg-stone-800 border border-stone-700 rounded px-1 py-0.5 mb-3"
        value={persona.modelId ?? ''}
        onChange={(e) => onChangeModel(e.target.value)}
      >
        <option value="" disabled>
          {persona.model ?? 'no model set'}
        </option>
        {modelOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {state.status === 'pending' && <p className="text-stone-500 italic">Awaiting testimony…</p>}
      {state.status === 'loading' && <p className="text-stone-500 italic">…deliberating</p>}
      {state.status === 'error' && (
        <div>
          <p className="text-red-400 mb-2">{state.error}</p>
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1 bg-stone-800 hover:bg-stone-700 rounded border border-stone-700"
          >
            Retry
          </button>
        </div>
      )}
      {state.status === 'done' && <p className="whitespace-pre-wrap">{state.content}</p>}
    </div>
  );
}
