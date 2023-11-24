/**
 * The Database oject.
 */
export class Database {
  /**
   * The constructor of the object.
   */
  constructor(options: Database.IOptions) {
    this._database = options.database;
  }

  /**
   *
   */
  get alias(): string {
    return this._database.alias;
  }

  get id(): number {
    return this._database.id;
  }

  /**
   * Build the url from the description.
   */
  get url(): string {
    let value = '';
    value += ` ${this._database.driver}`;
    value += '://';
    value += `/${this._database.database}`;
    value += this._database.port ? `:${this._database.port}` : '';
    return value;
  }

  /**
   * Return a string representation of the database.
   */
  text(): string {
    let value = '';
    let key: keyof Database.Description;
    for (key in this._database) {
      value += `${key}: ${this._database[key]?.toString()}\n`;
    }
    console.log(value);
    return value;
  }

  /**
   * Get an attribute of the database description if exists.
   */
  getValue(attribute: string): any {
    if (attribute in this._database) {
      return this._database[attribute as keyof Database.Description];
    } else {
      return undefined;
    }
  }

  private _database: Database.Description;
}

/**
 * Namespace for the Database.
 */
export namespace Database {
  /**
   * The options of the database object.
   */
  export interface IOptions {
    /**
     * The description of the database.
     */
    database: Description;
  }

  /**
   * The type of a describing a database.
   */
  export type Description = {
    alias: string;
    database: string;
    driver: string;
    id: number;
    is_async: boolean;
    host?: string;
    port?: number;
  };
}
