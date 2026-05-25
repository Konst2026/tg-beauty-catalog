export interface IDomainEvent {
  type: string;
}

export interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  subscribe<T extends IDomainEvent>(eventType: string, handler: (event: T) => Promise<void>): void;
}
