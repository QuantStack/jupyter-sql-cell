import { ITranslator } from '@jupyterlab/translation';
import { SidePanel, tableRowsIcon } from '@jupyterlab/ui-components';

import { requestAPI } from './handler';
import { DatabaseSection } from './sidepanelsection';

/**
 * The class of the side panel.
 */
const DATABASES_CLASS = 'jp-SqlCell-DatabasesPanel';

/**
 * The side panel containing the list of the databases.
 */
export class Databases extends SidePanel {
  /**
   * Constructor of the databases list.
   */
  constructor(options: Databases.IOptions) {
    super({ translator: options.translator });
    this.id = 'jp-sql-cell-sidebar';
    this.addClass(DATABASES_CLASS);
    this.title.icon = tableRowsIcon;
    this.title.caption = 'Databases';

    requestAPI<any>('databases')
      .then(data => {
        this._buildDatabaseSections(data);
      })
      .catch(reason => {
        console.error(reason);
      });
  }

  private _buildDatabaseSections(databases: Databases.IDatabase[]) {
    databases.forEach(database => {
      this.addWidget(new DatabaseSection({ database }));
    });
  }
}

/**
 * Namespace for the databases side panel.
 */
namespace Databases {
  /**
   * Options of the databases side panel's constructor.
   */
  export interface IOptions {
    translator: ITranslator;
  }

  /**
   * Database object.
   */
  export interface IDatabase {
    alias: string;
    database: string;
    driver: string;
    id: number;
    is_async: boolean;
    host?: string;
    port?: number;
  }
}
