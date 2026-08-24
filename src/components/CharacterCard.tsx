import type { CardState, PersonaCardInfo } from './cardTypes';
import type { ModelOption } from '../api/client';

export function CharacterCard({
  persona,
  state,
  modelOptions,
  onChangeModel,
  onRetry,
}: {
  persona: PersonaCardInfo;
  state: CardState;
  modelOptions: ModelOption[];
  onChangeModel: (modelId: string) => void;
  onRetry: () => void;
}) {
  const seatColor = persona.seat === 'defense' ? 'border-blue-700' : 'border-red-700';
  return (
    <div className={`rounded-lg border ${seatColor} bg-stone-900 p-4`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-serif">{persona.name}</h2>
        <span className="text-xs uppercase tracking-wide text-stone-400">{persona.seat}</span>
      </div>
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
      {state.status === 'loading' && <p className="text-stone-500 italic">…gathering testimony</p>}
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
