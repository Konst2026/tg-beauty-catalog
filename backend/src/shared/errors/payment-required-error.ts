import { DomainError } from './domain-error';

export class PaymentRequiredError extends DomainError {
  constructor(code = 'MASTER_SUBSCRIPTION_EXPIRED') {
    super('Subscription required', code);
    this.name = 'PaymentRequiredError';
  }
}
