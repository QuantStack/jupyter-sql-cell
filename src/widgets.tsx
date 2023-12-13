import { ICellModel } from '@jupyterlab/cells';
import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';

import { ICustomCodeCell, MAGIC } from './common';
import { Database } from './databases';
import { IDatabasesPanel } from './sidepanel';

/**
 * Database select widget.
 */
export class DatabaseSelect extends ReactWidget {
  constructor(options: {
    cellModel: ICellModel | undefined;
    databasesPanel: IDatabasesPanel;
  }) {
    super();
    this._cellModel = options.cellModel;
    this._databasesPanel = options.databasesPanel;
  }

  onChange = (event: React.FormEvent) => {
    const selection = (event.target as HTMLSelectElement).value;
    const database = this._databasesPanel.get_database(selection);
    if (this._cellModel && database) {
      Private.setDatabaseUrl(this._cellModel, database);
    }
  };

  render(): JSX.Element {
    const defaultValue = ' - ';
    let currentDatabase = defaultValue;
    const url = Private.getDatabaseUrl(this._cellModel);
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
        <select
          onChange={this.onChange}
          className={'jp-sqlcell-select'}
          disabled={this._cellModel?.type !== 'code'}
        >
          <option disabled selected={currentDatabase === defaultValue}>
            {defaultValue}
          </option>
          ;
          {aliases.map(alias => {
            return (
              <option selected={currentDatabase === alias}>{alias}</option>
            );
          })}
        </select>
      </label>
    );
  }

  private _cellModel: ICellModel | undefined;
  private _databasesPanel: IDatabasesPanel;
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

/**
 * The private namespace.
 */
namespace Private {
  export function getDatabaseUrl(
    cellModel: ICellModel | undefined
  ): string | undefined {
    if (!cellModel) {
      return;
    }
    const magicLine = cellModel.sharedModel.source.split('\n')[0];
    const regexp = new RegExp(`^${MAGIC}\\s+([^\\s]+)`);
    const match = magicLine.match(regexp);
    if (match && match.length > 1) {
      return match[1];
    }
  }

  /**
   * Update the contents of the magic line of the cell, accordingly to the selection.
   *
   * @param cellModel - the model of the cell whose contents are to be modified.
   * @param database - the selected database.
   */
  export function setDatabaseUrl(
    cellModel: ICellModel,
    database: Database | undefined
  ): void {
    const sourceArray = cellModel.sharedModel.source.split('\n');
    const magicLine = sourceArray[0].split(/\s+/);
    if (database) {
      magicLine[1] = `${database.url}`;
    }
    sourceArray[0] = magicLine.join(' ');
    cellModel.sharedModel.source = sourceArray.join('\n');
  }
}
