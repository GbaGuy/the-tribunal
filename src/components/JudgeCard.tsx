import type { CardState, PersonaCardInfo } from './cardTypes';

export function JudgeCard({ persona, state }: { persona: PersonaCardInfo; state: CardState }) {
  return (
    <div className="rounded-lg border border-amber-700 bg-stone-900 p-6">
      <h2 className="text-xl font-serif mb-1">{persona.name}</h2>
      <p className={`text-sm text-stone-400 ${persona.model ? 'mb-1' : 'mb-3'}`}>{persona.description}</p>
      {persona.model && <p className="text-xs text-stone-500 font-mono mb-3">{persona.model}</p>}
      {state.status === 'pending' && <p className="text-stone-500 italic">Awaiting testimony…</p>}
      {state.status === 'loading' && <p className="text-stone-500 italic">…deliberating</p>}
      {state.status === 'error' && <p className="text-red-400">{state.error}</p>}
      {state.status === 'done' && <p className="whitespace-pre-wrap">{state.content}</p>}
    </div>
  );
}
