const STORE_PREFIXES = ['Downtown', 'Midtown', 'Westside', 'Eastside', 'North', 'South', 'Central', 'Terminal', 'Grand', 'Valley']
const STORE_SUFFIXES = ['Hub', 'Express', 'Pavilion', 'Market', 'Plaza', 'Center', 'Station', 'Square', 'Boulevard', 'Avenue']

export function getStoreName(id: number | string | undefined): string {
  if (!id) return 'Unknown Store'
  const numericId = Number(id)
  const p = STORE_PREFIXES[numericId % STORE_PREFIXES.length]
  const s = STORE_SUFFIXES[(numericId * 3) % STORE_SUFFIXES.length]
  return `${p} ${s} (Store ${id})`
}

const ITEM_ADJS = ['Premium', 'Wireless', 'Organic', 'Smart', 'Advanced', 'Ergonomic', 'Pro', 'Elite', 'Classic', 'Ultra']
const ITEM_NOUNS = ['Smartphone', 'Earbuds', 'Coffee', 'Speaker', 'Monitor', 'Keyboard', 'Watch', 'Tablet', 'Headphones', 'Backpack']

export function getItemName(id: number | string | undefined): string {
  if (!id) return 'Unknown Item'
  const numericId = Number(id)
  const a = ITEM_ADJS[numericId % ITEM_ADJS.length]
  const n = ITEM_NOUNS[(numericId * 7) % ITEM_NOUNS.length]
  return `${a} ${n} (Item ${id})`
}
