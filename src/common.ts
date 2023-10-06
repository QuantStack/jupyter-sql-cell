import { ICellModel } from '@jupyterlab/cells';

/**
 * The command IDs of the extensions.
 */
export namespace CommandIDs {
  /**
   * Switch cell type between rax and SQL.
   */
  export const switchSQL = 'jupyter-sql-cell:switch';
  /**
   * Execute the query on the server.
   */
  export const execute = 'jupyter-sql-cell:execute';
}

/**
 * The SQL mimetype used by codemirror.
 */
export const SQL_MIMETYPE = 'text/x-sql';

/**
 * The SqlCell namespace.
 */
export namespace SqlCell {
  /**
   * Whether the cell is a raw cell.
   *
   * @param model - the cell model.
   */
  export function isRaw(model: ICellModel | undefined) {
    if (!model) {
      return false;
    }
    return model.type === 'raw';
  }

  /**
   * Whether the cell is an SQL cell.
   *
   * @param model - the cell model.
   */
  export function isSqlCell(model: ICellModel | undefined) {
    if (!model) {
      return false;
    }
    return model.type === 'raw' && model.getMetadata('format') === SQL_MIMETYPE;
  }
}
