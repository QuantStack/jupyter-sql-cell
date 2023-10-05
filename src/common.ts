import { ICellModel } from '@jupyterlab/cells';

export namespace CommandIDs {
  export const switchSQL = 'jupyter-sql-cell:switch';
  export const run = 'jupyter-sql-cell:execute';
}

export const SQL_MIMETYPE = 'text/x-sql';

export namespace SqlCell {
  export function isRaw(model: ICellModel | undefined) {
    if (!model) {
      return false;
    }
    return model.type === 'raw';
  }
  export function isSqlCell(model: ICellModel | undefined) {
    if (!model) {
      return false;
    }
    return model.type === 'raw' && model.getMetadata('format') === SQL_MIMETYPE;
  }
}
