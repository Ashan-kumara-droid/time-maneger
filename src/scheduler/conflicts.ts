import { PlannedSession } from './types';

export function assertNoSessionOverlaps(sessions: PlannedSession[]): void {
  const byDate = new Map<string, PlannedSession[]>();
  for (const session of sessions) {
    if (session.startMin >= session.endMin) throw new Error(`Invalid session interval: ${session.id}`);
    const group = byDate.get(session.date) ?? [];
    group.push(session);
    byDate.set(session.date, group);
  }
  for (const [date, group] of byDate) {
    group.sort((a, b) => a.startMin - b.startMin);
    for (let index = 1; index < group.length; index += 1) {
      if (group[index].startMin < group[index - 1].endMin) {
        throw new Error(`Sessions overlap on ${date}: ${group[index - 1].id}, ${group[index].id}`);
      }
    }
  }
}
