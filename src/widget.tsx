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

import { CommandIDs, SqlCell } from './common';

export class SqlWidget extends ReactWidget {
  /**
   * The constructor of the widget.
   */
  constructor(options: Private.IOptions) {
    super();
    this._commands = options.commands;
    this._tracker = options.tracker;
    this._activeCell = this._tracker.activeCell;
  }

  /**
   * Execute the command.
   */
  private _run() {
    this._commands.execute(CommandIDs.execute);
  }

  /**
   * Switch the status of the cell, SQL cell or not.
   */
  private _switch() {
    this._commands.execute(CommandIDs.switchSQL);
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
            className={'jp-sqlcell-widget'}
            aria-disabled={!SqlCell.isRaw(this._tracker.activeCell?.model)}
          >
            <span>SQL cell</span>
            <label className={'switch'}>
              <input
                type={'checkbox'}
                className={'sql-cell-check'}
                disabled={!SqlCell.isRaw(this._tracker.activeCell?.model)}
                aria-disabled={!SqlCell.isRaw(this._tracker.activeCell?.model)}
                onChange={this._switch.bind(this)}
                checked={SqlCell.isSqlCell(this._tracker.activeCell?.model)}
              />
              <span className={'slider'}></span>
            </label>
            <ToolbarButtonComponent
              enabled={SqlCell.isSqlCell(this._tracker.activeCell?.model)}
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
