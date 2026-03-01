// ObjectiveSystem — stub for future objective tracking
// Will be expanded to manage mission objectives, scoring, and faction reputation.

export type ObjectiveEventType = 'started' | 'completed' | 'failed';

export interface ObjectiveEvent {
  type: ObjectiveEventType;
  objectiveId: string;
  timestamp: number;
}

export class ObjectiveSystem {
  private activeObjectives: Set<string> = new Set();
  private completedObjectives: Set<string> = new Set();
  private eventLog: ObjectiveEvent[] = [];

  startObjective(id: string): void {
    this.activeObjectives.add(id);
    this.log('started', id);
  }

  completeObjective(id: string): void {
    if (!this.activeObjectives.has(id)) return;
    this.activeObjectives.delete(id);
    this.completedObjectives.add(id);
    this.log('completed', id);
  }

  failObjective(id: string): void {
    if (!this.activeObjectives.has(id)) return;
    this.activeObjectives.delete(id);
    this.log('failed', id);
  }

  isActive(id: string): boolean {
    return this.activeObjectives.has(id);
  }

  isCompleted(id: string): boolean {
    return this.completedObjectives.has(id);
  }

  getEventLog(): readonly ObjectiveEvent[] {
    return this.eventLog;
  }

  private log(type: ObjectiveEventType, objectiveId: string): void {
    this.eventLog.push({ type, objectiveId, timestamp: Date.now() });
  }
}
