import { safeNext } from './authRedirect';

test.each(['/pricing', '/booth?template=classic', '/billing/success?ref=PB-checkout123', '/settings#billing'])('preserves the internal destination %s', (next) => {
  expect(safeNext(next)).toBe(next);
});
test.each([undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\nevil.example', ' /pricing'])('rejects unsafe or missing destinations: %s', (next) => {
  expect(safeNext(next)).toBe('/dashboard');
});
