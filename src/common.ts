import { ICellModel } from '@jupyterlab/cells';
import { Database } from './databases';

/**
 * The code to inject to the kernel to load the sql magic.
 */
export const LOAD_MAGIC = '%load_ext sql';

/**
 * The expected magic.
 */
export const MAGIC = '%%sql';

/**
 * Custom code cell interface.
 */
export interface ICustomCodeCell {
  /**
   * The SQL status.
   */
  isSQL: boolean;
  /**
   * The name of the variable to copy the cell output to.
   */
  variable: string | null;
}

/**
 * The MagicLine namespace.
 */
export namespace MagicLine {
  /**
   * Return the database URL from the magic line of a cell.
   *
   * @param cellModel - the model of the cell to look for the database URL.
   */
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
