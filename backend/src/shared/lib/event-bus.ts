import { EventEmitter } from 'events';
import type { IDomainEvent, IEventBus } from '@/domain/ports/event-bus.port';

export class InProcessEventBus implements IEventBus {
  private readonly emitter = new EventEmitter();

  async publish(event: IDomainEvent): Promise<void> {
    this.emitter.emit(event.type, event);
  }

  subscribe<T extends IDomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void {
    this.emitter.on(eventType, (event: T) => {
      handler(event).catch(err =>
        console.error(`[EventBus] handler error for ${eventType}:`, err),
      );
    });
  }
}
