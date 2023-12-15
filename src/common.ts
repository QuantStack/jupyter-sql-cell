import { ICodeCellModel } from '@jupyterlab/cells';
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
   * The cell model.
   */
  model: ICodeCellModel;
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
    cellModel: ICodeCellModel | undefined
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
    cellModel: ICodeCellModel,
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

  /**
   * Return the variable from the magic line of a cell.
   *
   * @param cellModel - the model of the cell to look for the database URL.
   */
  export function getVariable(cellModel: ICodeCellModel): {
    value: string;
    displayOutput: boolean;
  } {
    const magicLine = cellModel.sharedModel.source.split('\n')[0];
    const regexp = new RegExp(`^${MAGIC}.*\\s(\\w+)(=?)\\s*<<$`);
    const match = magicLine.match(regexp);
    if (match && match.length > 1) {
      return { value: match[1], displayOutput: match[2] === '=' };
    }
    return { value: '', displayOutput: false };
  }

  /**
   * Update the content of the magic line to save the result in a variable.
   *
   * @param cellModel - the model of the cell whose contents are to be modified.
   * @param value - the name of the variable.
   */
  export function setVariable(
    cellModel: ICodeCellModel,
    value: string | undefined,
    displayOutput: boolean = false
  ): void {
    const sourceArray = cellModel.sharedModel.source.split('\n');
    let magicLine = sourceArray[0];
    const regexp = new RegExp(`^${MAGIC}.*(\\s\\w+=?\\s*<<)$`);
    const match = magicLine.match(regexp);

    const variableText = value ? ` ${value}${displayOutput ? '=' : ''} <<` : '';

    if (match) {
      magicLine = magicLine.replace(match[1], variableText);
    } else {
      magicLine += `${variableText}`;
    }
    sourceArray[0] = magicLine;
    cellModel.sharedModel.source = sourceArray.join('\n');
  }
}
