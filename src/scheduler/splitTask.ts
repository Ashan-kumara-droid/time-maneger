export function splitTask(
  remainingMinutes: number,
  slotCapacities: number[],
  minSessionMinutes = 25,
  maxSessionMinutes = 120,
): number[] {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) return [];

  let remaining = Math.floor(remainingMinutes);
  const chunks: number[] = [];
  for (const capacity of slotCapacities) {
    if (remaining <= 0) break;
    let available = Math.floor(capacity);
    while (remaining > 0) {
      const sessionCapacity = Math.min(available, maxSessionMinutes);
      if (sessionCapacity < minSessionMinutes && sessionCapacity < remaining) break;

      let chunk = Math.min(remaining, sessionCapacity);
      const remainder = remaining - chunk;
      if (remainder > 0 && remainder < minSessionMinutes) {
        const transfer = Math.min(minSessionMinutes - remainder, Math.floor((chunk - minSessionMinutes) / 2));
        if (transfer > 0) chunk -= transfer;
      }
      if (chunk < minSessionMinutes && chunk < remaining) break;
      chunks.push(chunk);
      remaining -= chunk;
      available -= chunk;
      if (available <= 0) break;
    }
  }
  return chunks;
}
