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

export interface NamedOpinion {
  name: string;
  content: string;
}

export function buildFinalVerdictPrompt(
  theCase: Case,
  responses: NamedResponse[],
  panelOpinions: NamedOpinion[]
): string {
  const transcript = responses.map((r) => `${r.name} (${r.seat}):\n${r.content}`).join('\n\n');
  const opinions = panelOpinions.map((o) => `${o.name}:\n${o.content}`).join('\n\n');
  return [
    buildCaseBriefing(theCase),
    '',
    'Arguments presented:',
    transcript,
    '',
    "Opinions from your fellow panel judges, who have already reviewed this case:",
    opinions,
    '',
    "Considering both the arguments presented and your fellow judges' opinions, render your own final judgment on the question above, with your reasoning.",
  ].join('\n');
}
