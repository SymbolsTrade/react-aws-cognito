export function uid() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now()
}