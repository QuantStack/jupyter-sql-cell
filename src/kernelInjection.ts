import { Token } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

/**
 * The kernel injection token.
 */
export const ISqlCellInjection = new Token<ISqlCellInjection>(
  '@jupyter/sql-cell:kernel-injection',
  'A boolean, whether the function has been injected in the kernel or not'
);

/**
 * The kernel injection status interface.
 */
export interface ISqlCellInjection {
  /**
   * Whether the current kernel has the function to populate data.
   */
  status: boolean;
  /**
   * A signal emitted when the status changes.
   */
  readonly statusChanged: ISignal<this, boolean>;
}

/**
 * The kernel injection status class.
 */
export class SqlCellInjection implements ISqlCellInjection {
  /**
   * Getter and setter of the status.
   */
  get status(): boolean {
    return this._status;
  }
  set status(value: boolean) {
    this._status = value;
    this.statusChanged.emit(value);
  }
  private _status = false;
  readonly statusChanged = new Signal<this, boolean>(this);
}
