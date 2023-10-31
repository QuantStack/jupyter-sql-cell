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
import { FieldProps } from '@rjsf/utils';

import { CommandIDs, SqlCell, objectEnum } from './common';

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
    this._commands.execute(CommandIDs.run);
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
          <div className={'jp-sqlcell-toolbar-widget'}>
            <span>SQL cell</span>
            <SqlSwitchWidget
              commands={this._commands}
              tracker={this._tracker}
            ></SqlSwitchWidget>
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
 * A toggle button used to switch a cell to SQL cell.
 */
export const SqlSwitchWidget = (options: Private.IOptions): JSX.Element => {
  const { commands, tracker } = options;

  const switchToSql = () => {
    commands.execute(CommandIDs.switchSQL);
  };

  return (
    <div className={'jp-sqlcell-widget'}>
      <span>Switch to SQL</span>
      <label className={'jp-sqlcell-switch'}>
        <input
          type={'checkbox'}
          className={'jp-sqlcell-check'}
          onChange={switchToSql}
          checked={SqlCell.isSqlCell(tracker.activeCell?.model)}
        />
        <span className={'slider'}></span>
      </label>
    </div>
  );
};

/**
 * A field including a select to associate a database.
 */
export const DatabaseSelect = (props: Private.ISelectProps) => {
  const onChange = (event: React.FormEvent) => {
    const value = (event.target as HTMLOptionElement).value;
    const select = props.schema.oneOf?.find(
      oneOf => (oneOf as objectEnum).title === value
    );
    props.onChange((select as objectEnum).const);
  };
  return (
    <div>
      <div className="jp-FormGroup-fieldLabel">{props.schema.title}</div>
      <select
        onChange={onChange}
        className={'form-control jp-sqlcell-select'}
        disabled={!SqlCell.isSqlCell(props.tracker.activeCell?.model)}
      >
        {props.schema.oneOf?.map(oneOf => {
          return <option>{(oneOf as objectEnum).title}</option>;
        })}
      </select>
    </div>
  );
};

/**
 * The Private namespace.
 */
namespace Private {
  /**
   * The interface of the options of the SqlWidget constructor.
   */
  export interface IOptions {
    commands: CommandRegistry;
    tracker: INotebookTracker;
  }

  /**
   * The database select props.
   */
  export interface ISelectProps extends FieldProps {
    tracker: INotebookTracker;
  }
}
