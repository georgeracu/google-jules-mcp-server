const MAX_TEXT_LENGTH = 10_000;

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

export function sanitizeText(text: string): string {
  let sanitized = text;
  for (const pattern of SECRET_PATTERNS) sanitized = sanitized.replace(pattern, "[REDACTED]");
  if (sanitized.length <= MAX_TEXT_LENGTH) return sanitized;
  const removed = sanitized.length - MAX_TEXT_LENGTH;
  return `${sanitized.slice(0, MAX_TEXT_LENGTH)}… [truncated ${removed} characters]`;
}
