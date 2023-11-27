import { ICellModel } from '@jupyterlab/cells';
import { ReactWidget } from '@jupyterlab/ui-components';

import React from 'react';

import { MAGIC } from './common';
import { Database } from './databases';
import { IDatabasesPanel } from './sidepanel';

/**
 * Database select widget.
 */
export class DatabaseSelect extends ReactWidget {
  constructor(options: {
    cellModel: ICellModel | null;
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
      <div>
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
      </div>
    );
  }

  private _cellModel: ICellModel | null;
  private _databasesPanel: IDatabasesPanel;
}

/**
 * The private namespace.
 */
namespace Private {
  export function getDatabaseUrl(
    cellModel: ICellModel | null
  ): string | undefined {
    if (!cellModel) {
      return;
    }
    const regexp = new RegExp(`^${MAGIC}\\s+((?!\\s).*)`);
    const magicLine = cellModel.sharedModel.source.split('\n')[0];
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
    let magicLine = MAGIC;
    if (database) {
      magicLine += ` ${database.url}`;
    }
    const source = cellModel.sharedModel.source;
    const sourceArray = source.split('\n');
    sourceArray[0] = magicLine;
    cellModel.sharedModel.source = sourceArray.join('\n');
  }
}
