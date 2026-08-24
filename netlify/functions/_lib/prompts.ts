import type { Case } from './types';

export function buildCaseBriefing(theCase: Case): string {
  return [
    `Case: ${theCase.title}`,
    `Accused: ${theCase.accused}`,
    theCase.deceased ? `Deceased: ${theCase.deceased}` : null,
    `Act alleged: ${theCase.act_alleged}`,
    '',
    'Agreed factual record:',
    theCase.facts_md,
    '',
    'Question for judgment:',
    theCase.question_md,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export interface NamedResponse {
  name: string;
  seat: string;
  content: string;
}

export function buildVerdictPrompt(theCase: Case, responses: NamedResponse[]): string {
  const transcript = responses.map((r) => `${r.name} (${r.seat}):\n${r.content}`).join('\n\n');
  return [
    buildCaseBriefing(theCase),
    '',
    'Arguments presented:',
    transcript,
    '',
    'Render your judgment on the question above, with your reasoning.',
  ].join('\n');
}
