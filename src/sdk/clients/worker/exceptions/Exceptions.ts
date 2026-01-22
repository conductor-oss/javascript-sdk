/**
 * Custom exception types for worker error handling.
 */

/**
 * Exception indicating a non-retryable task failure.
 * 
 * When thrown from a worker's execute function, the task will be marked as
 * FAILED_WITH_TERMINAL_ERROR and will NOT be retried, regardless of the
 * task definition's retry_count setting.
 * 
 * Use this for permanent failures where retry would produce the same result:
 * - Business validation failures (invalid data format)
 * - Authorization failures (user lacks permission)
 * - Resource not found (entity doesn't exist)
 * - Configuration errors (missing required config)
 * - Data integrity violations (constraint violations)
 * - Unsupported operations (feature not available)
 * 
 * @example
 * ```typescript
 * async function validateOrder(task: Task) {
 *   const order = await getOrder(task.inputData.orderId);
 *   
 *   if (!order) {
 *     // Order doesn't exist - retry won't help
 *     throw new NonRetryableException(`Order ${task.inputData.orderId} not found`);
 *   }
 *   
 *   if (order.status === 'CANCELLED') {
 *     // Business rule - retry won't help
 *     throw new NonRetryableException('Cannot process cancelled order');
 *   }
 *   
 *   return { status: 'COMPLETED', outputData: { validated: true } };
 * }
 * ```
 */
export class NonRetryableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableException";
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NonRetryableException);
    }
  }
}
