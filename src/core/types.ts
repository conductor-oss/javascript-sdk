import { TaskResult }  from "../common/open-api";
export class ConductorError extends Error {
  private _trace;
  private __proto__: unknown;

  constructor(message?: string, innerError?: Error) {
    super(message);
    this._trace = innerError;
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
  }
}
export type TaskResultStatus = NonNullable<TaskResult['status']>;