import { ISessionContext } from '@jupyterlab/apputils';
import { CodeCell } from '@jupyterlab/cells';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { Kernel, KernelMessage, Session } from '@jupyterlab/services';
import { Token } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { LOAD_MAGIC } from './common';

/**
 * The kernel injection token.
 */
export const IKernelInjection = new Token<IKernelInjection>(
  '@jupyter/sql-cell:kernel-injection',
  'A boolean, whether the function has been injected in the kernel or not'
);

/**
 * The kernel injection status interface.
 */
export interface IKernelInjection {
  /**
   * Whether the kernel associated to the cell can handle SQL magic.
   */
  getStatus(cell: CodeCell | null): boolean;
  /**
   * Add a new session context to the map.
   *
   * @param sessionContext - the session context to add.
   */
  addSessionContext(sessionContext: ISessionContext): void;
  /**
   * A signal emitted when the status changes.
   */
  readonly statusChanged: ISignal<this, void>;
}

/**
 * The kernel injection status class.
 */
export class KernelInjection implements IKernelInjection {
  /**
   * Whether the kernel associated to the cell can handle SQL magic.
   */
  getStatus(cell: CodeCell | null): boolean {
    const sessionContext = ((cell?.parent as Notebook)?.parent as NotebookPanel)
      ?.sessionContext;
    return this._status.get(sessionContext) ?? false;
  }

  /**
   * Add a new session context to the map.
   *
   * @param sessionContext - the session context to add.
   */
  addSessionContext(sessionContext: ISessionContext) {
    if (this._status.get(sessionContext) !== undefined) {
      return;
    }

    this._status.set(sessionContext, false);

    const kernel = sessionContext?.session?.kernel;
    if (kernel) {
      this._onKernelChanged(sessionContext, {
        name: 'kernel',
        oldValue: null,
        newValue: kernel
      });
    }
    sessionContext?.kernelChanged.connect(this._onKernelChanged, this);

    sessionContext.disposed.connect(sessionContext => {
      sessionContext.kernelChanged.disconnect(this._onKernelChanged, this);
    });
  }

  /**
   * Triggered when the current kernel changes.
   */
  private _onKernelChanged = async (
    sessionContext: ISessionContext,
    kernelChange: Session.ISessionConnection.IKernelChangedArgs
  ) => {
    this._status.set(sessionContext, false);
    const kernel = kernelChange.newValue;
    if (kernel) {
      this._runCode(kernel, LOAD_MAGIC).then(reply => {
        if (reply) {
          this._status.set(sessionContext, reply.content.status === 'ok');
          this.statusChanged.emit();
        }
        if (reply?.content.status !== 'ok') {
          console.warn('The kernel does not support SQL magics');
        }
      });
    }
  };

  /**
   * Run code in the specified kernel.
   */
  private async _runCode(
    kernel: Kernel.IKernelConnection,
    code: string
  ): Promise<KernelMessage.IExecuteReplyMsg | null> {
    return kernel.info
      .then(async () => {
        const content: KernelMessage.IExecuteRequestMsg['content'] = {
          code,
          store_history: false
        };
        const future = kernel.requestExecute(content);
        return future.done
          .then(reply => {
            return reply;
          })
          .catch(error => {
            return null;
          });
      })
      .catch(() => {
        return null;
      });
  }

  readonly statusChanged = new Signal<this, void>(this);
  private _status = new Map<ISessionContext, boolean>();
}
