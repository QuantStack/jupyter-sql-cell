import { Cell, ICellModel } from '@jupyterlab/cells';
import { INotebookTracker } from '@jupyterlab/notebook';
import {
  ToolbarButtonComponent,
  ReactWidget,
  UseSignal,
  runIcon
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Signal } from '@lumino/signaling';
import * as React from 'react';

export class SqlWidget extends ReactWidget {
  /**
   * The constructor of the widget.
   */
  constructor(options: Private.IOptions) {
    super();
    this._commands = options.commands;
    this._commandID = options.commandID;
    this._tracker = options.tracker;
    this._activeCell = this._tracker.activeCell;
  }

  /**
   * Execute the command.
   */
  private _run() {
    this._commands.execute(this._commandID);
  }

  /**
   * Switch the status of the cell, SQL cell or not.
   *
   * @param event - the mouse event that triggered the function.
   */
  private _switch(event: React.ChangeEvent) {
    const model = this._tracker.activeCell?.model;
    if (!model || model.type !== 'raw') {
      return;
    }
    model.setMetadata('sql-cell', (event.target as HTMLInputElement).checked);
  }

  /**
   * A signal used to handle the metadata changed on the current cell.
   *
   * ## FIXME:
   * We should use an other signal, the widget should update with the original
   * metadata change signal.
   */
  private _metadataChanged = () => {
    this._signal.emit();
  };

  /**
   * The definition of the widget to display.
   *
   * @returns - React element corresponding to the widget.
   */
  private _widget = () => {
    if (this._activeCell?.model) {
      this._activeCell.model.metadataChanged.disconnect(this._metadataChanged);
    }

    this._activeCell = this._tracker.activeCell;
    if (this._activeCell?.model) {
      this._activeCell?.model.metadataChanged.connect(this._metadataChanged);
    }

    return (
      <UseSignal signal={this._signal}>
        {() => (
          <div
            className={'sql-cell-widget'}
            aria-disabled={this._tracker.activeCell?.model.type !== 'raw'}
          >
            <span>SQL cell</span>
            <label className={'switch'}>
              <input
                type={'checkbox'}
                className={'sql-cell-check'}
                disabled={this._tracker.activeCell?.model.type !== 'raw'}
                aria-disabled={this._tracker.activeCell?.model.type !== 'raw'}
                onChange={event => this._switch(event)}
                checked={this._tracker.activeCell?.model.getMetadata(
                  'sql-cell'
                )}
              />
              <span className={'slider'}></span>
            </label>
            <ToolbarButtonComponent
              enabled={
                this._tracker.activeCell?.model.type === 'raw' &&
                this._tracker.activeCell?.model.getMetadata('sql-cell') === true
              }
              icon={runIcon}
              onClick={this._run.bind(this)}
            ></ToolbarButtonComponent>
          </div>
        )}
      </UseSignal>
    );
  };

  render(): JSX.Element {
    return (
      <UseSignal signal={this._tracker.activeCellChanged}>
        {this._widget}
      </UseSignal>
    );
  }

  private _commands: CommandRegistry;
  private _commandID: string;
  private _tracker: INotebookTracker;
  private _activeCell: Cell<ICellModel> | null;
  private _signal = new Signal<this, void>(this);
}

/**
 * The Private namespace.
 */
namespace Private {
  /**
   * The interface of the options of the SqlWidget constructor.
   */
  export interface IOptions {
    commands: CommandRegistry;
    commandID: string;
    tracker: INotebookTracker;
  }
}
