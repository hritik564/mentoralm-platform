export class StudentError extends Error {
  constructor(
    public code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'INVALID_INPUT'
      | 'CONFLICT'
      | 'UNAVAILABLE'
      | 'RATE_LIMITED',
  ) {
    super(code);
  }
}
export const errorMessages = {
  RATE_LIMITED: 'Please wait a moment before trying again.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'This action is not available for your account.',
  NOT_FOUND: 'This item is not available.',
  INVALID_INPUT:
    'Check the fields and use plain text within the allowed limits.',
  CONFLICT: 'This action is no longer available.',
  UNAVAILABLE:
    'Student data is temporarily unavailable. Please try again later.',
};
export const errorStatus = {
  RATE_LIMITED: 429,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  UNAVAILABLE: 503,
};
