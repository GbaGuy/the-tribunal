export type CardStatus = 'pending' | 'loading' | 'done' | 'error';

export interface CardState {
  status: CardStatus;
  content?: string;
  error?: string;
}

export interface PersonaCardInfo {
  id: string;
  name: string;
  seat: 'defense' | 'prosecution' | null;
  description: string;
  model: string | null;
}
