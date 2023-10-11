import {
  PanelWithToolbar,
  ReactWidget,
  ToolbarButton,
  deleteIcon
} from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import * as React from 'react';

/**
 * The class of the side panel.
 */
const DATABASE_CLASS = 'jp-SqlCell-database';
/**
 * The class of the element containing the id of the database.
 */
const DATABASE_TOOLBAR_CLASS = 'jp-SqlCell-database-toolbar';
/**
 * The class of the element containing the id of the database.
 */
const DATABASE_TOOLBAR_BUTTON_CLASS = 'jp-SqlCell-database-toolbarButton';
/**
 * The class of the element containing the url of the database.
 */
const DATABASE_BODY_CLASS = 'jp-SqlCell-database-body';

/**
 * The database section.
 */
export class DatabaseSection extends PanelWithToolbar {
  constructor(options: DatabaseSection.IOptions) {
    super(options);
    this._database = options.database;
    this.addClass(DATABASE_CLASS);
    this.title.label = this._database.alias;
    this.toolbar.addClass(DATABASE_TOOLBAR_CLASS);

    const button = new ToolbarButton({
      icon: deleteIcon,
      className: `${DATABASE_TOOLBAR_BUTTON_CLASS} jp-mod-styled
      }`,
      onClick: () => {
        console.log('should remove the database');
      }
    });
    this.toolbar.addItem('view-VariableTreeView', button);

    const body = ReactWidget.create(<SectionBody database={this._database} />);
    body.addClass(DATABASE_BODY_CLASS);
    this.addWidget(body);
  }

  private _database: DatabaseSection.IDatabase;
}

const SectionBody = ({
  database
}: {
  database: DatabaseSection.IDatabase;
}): JSX.Element => {
  return (
    <table>
      {Object.entries(database).map(([key, value]) => (
        <tr>
          <td>{key}</td>
          <td>
            {database[key as keyof DatabaseSection.IDatabase]?.toString()}
          </td>
        </tr>
      ))}
    </table>
  );
};

/**
 * Namespace for the database section.
 */
namespace DatabaseSection {
  /**
   * Options for the DatabaseSection constructor.
   */
  export interface IOptions extends Panel.IOptions {
    database: IDatabase;
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
