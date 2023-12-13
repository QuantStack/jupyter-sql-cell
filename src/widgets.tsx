import { ICellModel } from '@jupyterlab/cells';
import { ReactWidget, UseSignal } from '@jupyterlab/ui-components';
import { ISignal } from '@lumino/signaling';
import React from 'react';

import { ICustomCodeCell, MagicLine } from './common';
import { IDatabasesPanel } from './sidepanel';

/**
 * Database select widget.
 */
export class DatabaseSelect extends ReactWidget {
  constructor(options: {
    cellModel: ICellModel | undefined;
    databasesPanel: IDatabasesPanel;
    databaseChanged: ISignal<ICustomCodeCell, string>;
  }) {
    super();
    this._cellModel = options.cellModel;
    this._databasesPanel = options.databasesPanel;
    this._databaseChanged = options.databaseChanged;
  }

  onChange = (event: React.FormEvent) => {
    const selection = (event.target as HTMLSelectElement).value;
    const database = this._databasesPanel.get_database(selection);
    if (this._cellModel && database) {
      MagicLine.setDatabaseUrl(this._cellModel, database);
    }
  };

  render(): JSX.Element {
    const defaultValue = ' - ';
    let currentDatabase = defaultValue;
    const url = MagicLine.getDatabaseUrl(this._cellModel);
    const aliases: string[] = [];
    this._databasesPanel?.databases.forEach(database => {
      aliases.push(database.alias);
      if (database.url === url) {
        currentDatabase = database.alias;
      }
    });
    return (
      <label>
        Database:&nbsp;
        <UseSignal signal={this._databaseChanged} initialArgs={currentDatabase}>
          {(_, databaseURL) => {
            return (
              <select
                onChange={this.onChange}
                className={'jp-sqlcell-select'}
                disabled={this._cellModel?.type !== 'code'}
              >
                <option disabled selected={databaseURL === defaultValue}>
                  {defaultValue}
                </option>
                {aliases.map(alias => {
                  return (
                    <option selected={databaseURL === alias}>{alias}</option>
                  );
                })}
              </select>
            );
          }}
        </UseSignal>
      </label>
    );
  }

  private _cellModel: ICellModel | undefined;
  private _databasesPanel: IDatabasesPanel;
  private _databaseChanged: ISignal<ICustomCodeCell, string>;
}

/**
 * An input to set the variable name, where to store the output of sql.
 *
 * @param fn : the callback function.
 */
export class VariableName extends ReactWidget {
  constructor(options: { cell: ICustomCodeCell }) {
    super();
    this._cell = options.cell;
    this._value = this._cell.variable ?? '';
  }

  private _onChange = (event: React.ChangeEvent) => {
    this._value = (event.target as HTMLInputElement).value;
    this._cell.variable = this._value;
  };

  render() {
    return (
      <input
        type={'text'}
        placeholder={'Variable name'}
        onChange={this._onChange}
        title={'The variable where to copy the cell output'}
        defaultValue={this._value}
      ></input>
    );
  }

  private _cell: ICustomCodeCell;
  private _value: string;
}
