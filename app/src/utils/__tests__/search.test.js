import { snippetRuns, resultHref } from '../search';

describe('snippetRuns', () => {
  it('splits highlighted matches out', () => {
    expect(snippetRuns('the [[sourdough]] plan, [[sour]] dough')).toEqual([
      { text: 'the ', hit: false },
      { text: 'sourdough', hit: true },
      { text: ' plan, ', hit: false },
      { text: 'sour', hit: true },
      { text: ' dough', hit: false },
    ]);
  });

  it('copes with no matches and nothing at all', () => {
    expect(snippetRuns('plain')).toEqual([{ text: 'plain', hit: false }]);
    expect(snippetRuns(null)).toEqual([]);
  });
});

describe('resultHref', () => {
  it('jumps to the moment, or opens the conversation', () => {
    expect(resultHref({ kind: 'said', cast_id: 'c1', at_ms: 151000 })).toBe('/cast/c1?at=151000');
    expect(resultHref({ kind: 'cast', cast_id: 'c1', at_ms: null })).toBe('/cast/c1');
    expect(resultHref({ kind: 'note', other_id: 'ben', cast_id: null })).toBe('/notes/ben');
  });
});
