import { LDR_ARRANGEMENTS, arrange, getArrangement, planFor } from './ldr';
import { getTemplate, LAYOUTS, TEMPLATES } from '../templates/data';
import { computeLayout } from '../templates/render';

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

test.each(['miles-apart', 'happy-halloween'])('every arrangement changes the actual photo geometry for %s', (id) => {
  const template = getTemplate(id);
  const sizes = new Set();
  LDR_ARRANGEMENTS.forEach((arrangement) => {
    const plan = planFor(arrangement, template);
    expect(plan.layout.id).toBe(arrangement.layoutId);
    const geometry = computeLayout(template, 4 / 3, plan.layout);
    expect(geometry.slots).toHaveLength(arrangement.slots.length);
    sizes.add(`${geometry.W}x${geometry.H}`);
  });
  // Alternate/scrapbook share a layout; Duo, side-by-side and grid are distinct.
  expect(sizes.size).toBe(4);
});

test('the scrapbook arrangement uses a real template', () => {
  expect(TEMPLATES.map((t) => t.id)).toContain(getArrangement('scrapbook').templateId);
  expect(arrange(planFor(getArrangement('scrapbook'), getTemplate('miles-apart')).slots, { A: ['a'], B: [] })).toEqual(['a', null, null, null]);
});
