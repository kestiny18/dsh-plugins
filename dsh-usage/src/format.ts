/** Format an integer nano-currency amount without losing sub-cent session costs. */
export function formatCost(costNano: number, currency: string): string {
  const amount = costNano / 1_000_000_000
  return `${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount === 0 ? 2 : 6,
    maximumFractionDigits: 9,
  }).format(amount)} ${currency}`
}
