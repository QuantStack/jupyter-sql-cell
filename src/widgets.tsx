import { ICellModel } from '@jupyterlab/cells';
import * as React from 'react';

import { MAGIC } from './common';
import { Databases, IDatabasesPanel } from './sidepanel';

/**
 * A field including a select to associate a database.
 */
export const DatabaseSelect = (options: {
  cellModel: ICellModel | null;
  databasesPanel: IDatabasesPanel;
}) => {
  const onChange = (event: React.FormEvent) => {
    const selection = (event.target as HTMLSelectElement).value;
    const database = options.databasesPanel.get_database(selection);
    if (options.cellModel && database) {
      Private.changeDatabase(options.cellModel, database);
    }
  };
  return (
    <div>
      <label>
        Database:&nbsp;
        <select
          onChange={onChange}
          className={'jp-sqlcell-select'}
          disabled={options.cellModel?.type !== 'code'}
        >
          <option> - </option>
          {options.databasesPanel?.databases.map(database => {
            return <option>{database.alias}</option>;
          })}
        </select>
      </label>
    </div>
  );
};

/**
 * The private namespace.
 */
namespace Private {
  /**
   * Update the contents of the magic line of the cell, accordingly to the selection.
   *
   * @param cellModel - the model of the cell whose contents are to be modified.
   * @param database - the selected database.
   */
  export function changeDatabase(
    cellModel: ICellModel,
    database: Databases.IDatabase
  ): void {
    let magicLine = MAGIC;
    magicLine += ` ${database.driver}`;
    magicLine += '://';
    magicLine += `/${database.database}`;
    magicLine += database.port ? `:${database.port}` : '';

    const source = cellModel.sharedModel.source;
    const sourceArray = source.split('\n');
    sourceArray[0] = magicLine;
    cellModel.sharedModel.source = sourceArray.join('\n');
  }
}
