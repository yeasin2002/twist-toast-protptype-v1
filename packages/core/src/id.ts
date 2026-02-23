let counter = 0;

export function createToastId(): string {
  counter += 1;
  return `tt-${Date.now().toString(36)}-${counter.toString(36)}`;
}
