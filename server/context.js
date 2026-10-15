// Per-request context: lets the database layer know whether a write came from an order/admin change
// (saved to the backup within seconds) or from background bookkeeping (saved every few minutes).
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();
