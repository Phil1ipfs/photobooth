import { LDR_ARRANGEMENTS, arrange, getArrangement, planFor } from './ldr';
import { getTemplate, LAYOUTS, TEMPLATES } from '../templates/data';

const shots = { A: ['a0', 'a1', 'a2'], B: ['b0', 'b1', 'b2'] };

test('arrangements fill every slot with both people', () => {
  expect(arrange(planFor(getArrangement('alternate')).slots, shots)).toEqual(['a0', 'b0', 'a1', 'b1']);
  expect(arrange(planFor(getArrangement('grid')).slots, shots)).toEqual(['a0', 'b0', 'b1', 'a1']);
  expect(arrange(planFor(getArrangement('side')).slots, shots)).toEqual(['a0', 'b0', 'a1', 'b1', 'a2', 'b2']);
  LDR_ARRANGEMENTS.forEach((a) => {
    const { layout, slots, rounds } = planFor(a);
    expect(slots).toHaveLength(layout.photoCount);
    expect(LAYOUTS.map((l) => l.id)).toContain(a.layoutId);
    expect(new Set(slots.map(([w]) => w))).toEqual(new Set(['A', 'B']));
    expect(rounds).toBe(Math.ceil(layout.photoCount / 2));
  });
});

test('templates with their own layout keep it (e.g. Halloween 1 × 2)', () => {
  const plan = planFor(getArrangement('side'), getTemplate('happy-halloween'));
  expect(plan.layout.id).toBe('strip-1x2');
  expect(arrange(plan.slots, shots)).toEqual(['a0', 'b0']);
  expect(plan.rounds).toBe(1);
});

test('the scrapbook arrangement uses a real template', () => {
  expect(TEMPLATES.map((t) => t.id)).toContain(getArrangement('scrapbook').templateId);
  expect(arrange(planFor(getArrangement('scrapbook'), getTemplate('miles-apart')).slots, { A: ['a'], B: [] })).toEqual(['a', null, null, null]);
});
