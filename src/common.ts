import { ICellModel } from '@jupyterlab/cells';
import { PartialJSONObject } from '@lumino/coreutils';

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
  export const run = 'jupyter-sql-cell:execute';
}

/**
 * The SQL mimetype used by codemirror.
 */
export const SQL_MIMETYPE = 'text/x-sql';

/**
 * The path to the configuration in the metadata.
 */
export const SQL_CELL_METADATA = 'sql-cell';

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

  /**
   * Get a cell metadata in SQL_CELL_METADATA path.
   *
   * @param model - the cell model.
   * @returns the cell metadata in SQL_CELL_METADATA path.
   */
  export function getMetadata(model: ICellModel | undefined, key: string): any {
    if (!model) {
      return undefined;
    }
    try {
      return model.getMetadata(SQL_CELL_METADATA)[key];
    } catch {
      return undefined;
    }
  }

  /**
   * Update a cell metadata in SQL_CELL_METADATA path.
   *
   * @param model - the cell model.
   * @param key - the key of the metadata in SQL_CELL_METADATA path.
   * @param value - the value of the metadata.
   */
  export function setMetadata(
    model: ICellModel | undefined,
    key: string,
    value: any
  ) {
    if (!model) {
      return;
    }
    let metadata = model.getMetadata(SQL_CELL_METADATA);
    if (metadata === undefined) {
      metadata = {};
    }
    metadata[key] = value;
    model.setMetadata(SQL_CELL_METADATA, metadata);
  }

  /**
   * Delete a cell metadata from SQL_CELL_METADATA path.
   *
   * @param model - the cell model.
   * @param key - the key of the metadata to delete from SQL_CELL_METADATA path.
   */
  export function deleteMetadata(
    model: ICellModel | undefined,
    key: string
  ): void {
    if (!model) {
      return;
    }
    const metadata = model.getMetadata(SQL_CELL_METADATA);
    if (!metadata || !Object.keys(metadata).includes(key)) {
      return;
    }
    delete metadata[key];
    model.setMetadata(SQL_CELL_METADATA, metadata);
  }
}

/**
 * The type for object enumeration (compatible with JSON schema)
 */
export type objectEnum = {
  const: PartialJSONObject | null;
  title: string;
};
