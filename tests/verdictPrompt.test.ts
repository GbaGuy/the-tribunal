import { describe, it, expect } from 'vitest';
import { buildCaseBriefing, buildVerdictPrompt, buildFinalVerdictPrompt } from '../netlify/functions/_lib/prompts';
import type { Case } from '../netlify/functions/_lib/types';

const sampleCase: Case = {
  id: 'case-1',
  slug: 't-001-realm-v-jon-snow',
  title: 'The Realm v. Jon Snow',
  accused: 'Jon Snow',
  deceased: 'Daenerys Targaryen',
  act_alleged: 'Jon stabbed Daenerys in the throne room.',
  facts_md: "King's Landing had surrendered.",
  question_md: 'Was the killing justified?',
};

describe('buildCaseBriefing', () => {
  it('includes the case title, accused, act alleged, facts, and question', () => {
    const briefing = buildCaseBriefing(sampleCase);
    expect(briefing).toContain('The Realm v. Jon Snow');
    expect(briefing).toContain('Jon Snow');
    expect(briefing).toContain('Daenerys Targaryen');
    expect(briefing).toContain("King's Landing had surrendered.");
    expect(briefing).toContain('Was the killing justified?');
  });

  it('omits the deceased line when there is no deceased', () => {
    const briefing = buildCaseBriefing({ ...sampleCase, deceased: null });
    expect(briefing).not.toContain('Deceased:');
  });
});

describe('buildVerdictPrompt', () => {
  it('includes the case briefing and every response with its speaker name and seat', () => {
    const prompt = buildVerdictPrompt(sampleCase, [
      { name: 'Jon Snow', seat: 'defense', content: 'I acted to protect the realm.' },
      { name: 'Grey Worm', seat: 'prosecution', content: 'He killed an unarmed queen.' },
    ]);

    expect(prompt).toContain('The Realm v. Jon Snow');
    expect(prompt).toContain('Jon Snow (defense)');
    expect(prompt).toContain('I acted to protect the realm.');
    expect(prompt).toContain('Grey Worm (prosecution)');
    expect(prompt).toContain('He killed an unarmed queen.');
  });
});

describe('buildFinalVerdictPrompt', () => {
  it('includes the case briefing, character arguments, and both panel opinions', () => {
    const prompt = buildFinalVerdictPrompt(
      sampleCase,
      [
        { name: 'Jon Snow', seat: 'defense', content: 'I acted to protect the realm.' },
        { name: 'Grey Worm', seat: 'prosecution', content: 'He killed an unarmed queen.' },
      ],
      [
        { name: 'Judge Barak', content: 'The killing was a proportionate necessity.' },
        { name: 'Judge Elon', content: 'The act cannot be reconciled with due process.' },
      ]
    );

    expect(prompt).toContain('The Realm v. Jon Snow');
    expect(prompt).toContain('Jon Snow (defense)');
    expect(prompt).toContain('I acted to protect the realm.');
    expect(prompt).toContain('Grey Worm (prosecution)');
    expect(prompt).toContain('He killed an unarmed queen.');
    expect(prompt).toContain('Judge Barak');
    expect(prompt).toContain('The killing was a proportionate necessity.');
    expect(prompt).toContain('Judge Elon');
    expect(prompt).toContain('The act cannot be reconciled with due process.');
  });
});
