export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'case', label: 'Upper & lowercase letters', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'number', label: 'At least one number', test: (v) => /\d/.test(v) },
];

export const passwordIssues = (value) => PASSWORD_RULES.filter((r) => !r.test(value));

export function validateEmail(email) {
  if (!email.trim()) return 'Please enter your email address.';
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
  return '';
}

export function validateName(name) {
  if (!name.trim()) return 'Please enter your name.';
  if (name.trim().length < 2) return 'Name should be at least 2 characters.';
  if (name.trim().length > 60) return 'Name should be 60 characters or fewer.';
  return '';
}

export function validateNewPassword(password) {
  if (!password) return 'Please create a password.';
  const issues = passwordIssues(password);
  if (issues.length) return 'Password doesn’t meet the requirements below.';
  return '';
}
