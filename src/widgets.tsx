import { ICellModel } from '@jupyterlab/cells';
import * as React from 'react';

import { IDatabasesPanel } from './sidepanel';

/**
 * A field including a select to associate a database.
 */
export const DatabaseSelect = (options: {
  cellModel: ICellModel | null;
  databasesPanel: IDatabasesPanel;
}) => {
  const onChange = (event: React.FormEvent) => {
    console.log(
      `Value changed to '${(event.target as HTMLSelectElement).value}'`
    );
  };
  console.log(options.databasesPanel);
  return (
    <div>
      <div className="jp-FormGroup-fieldLabel"></div>
      <select
        onChange={onChange}
        className={'form-control jp-sqlcell-select'}
        disabled={options.cellModel?.type !== 'code'}
      >
        <option> - </option>
        {options.databasesPanel?.databases.map(database => {
          return <option>{database.alias}</option>;
        })}
      </select>
    </div>
  );
};
