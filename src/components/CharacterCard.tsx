import type { CardState, PersonaCardInfo } from './cardTypes';

export function CharacterCard({ persona, state }: { persona: PersonaCardInfo; state: CardState }) {
  const seatColor = persona.seat === 'defense' ? 'border-blue-700' : 'border-red-700';
  return (
    <div className={`rounded-lg border ${seatColor} bg-stone-900 p-4`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-serif">{persona.name}</h2>
        <span className="text-xs uppercase tracking-wide text-stone-400">{persona.seat}</span>
      </div>
      <p className="text-sm text-stone-400 mb-3">{persona.description}</p>
      {state.status === 'loading' && <p className="text-stone-500 italic">…gathering testimony</p>}
      {state.status === 'error' && <p className="text-red-400">{state.error}</p>}
      {state.status === 'done' && <p className="whitespace-pre-wrap">{state.content}</p>}
    </div>
  );
}
