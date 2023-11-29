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
