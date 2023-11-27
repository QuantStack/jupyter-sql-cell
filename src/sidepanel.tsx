import { ITranslator } from '@jupyterlab/translation';
import {
  LabIcon,
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  ToolbarButton,
  UseSignal,
  caretDownIcon,
  caretRightIcon,
  deleteIcon,
  tableRowsIcon
} from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { AccordionPanel, Panel } from '@lumino/widgets';
import * as React from 'react';

import { Database } from './databases';
import { requestAPI } from './handler';
import databaseSvgstr from '../style/icons/database.svg';

/**
 * The class of the side panel.
 */
const DATABASES_CLASS = 'jp-sqlcell-databases-panel';
/**
 * The class of the side panel.
 */
const DATABASE_CLASS = 'jp-sqlcell-database';
/**
 * The class of the database toolbar.
 */
const TOOLBAR_CLASS = 'jp-sqlcell-database-toolbar';
/**
 * The class of the body of the database.
 */
const DATABASE_BODY_CLASS = 'jp-sqlcell-database-body';
/**
 * The class of tables list.
 */
const TABLE_ITEMS_CLASS = 'jp-sqlcell-table-items';
/**
 * The class of table name.
 */
const TABLE_TITLE_CLASS = 'jp-sqlcell-table-title';
/**
 * The class of the column item.
 */
const COLUMN_ITEMS_CLASS = 'jp-sqlcell-column-items';

/**
 * The database icon.
 */
const databaseIcon = new LabIcon({
  name: 'sql-cell:database',
  svgstr: databaseSvgstr
});

/**
 * The databases side panel token.
 */
export const IDatabasesPanel = new Token<IDatabasesPanel>(
  '@jupyter/sql-cell:databases-list',
  'The databases side panel.'
);

/**
 * The Databases interface.
 */
export interface IDatabasesPanel {
  /**
   * Get a database from its alias.
   */
  get_database(alias: string): Database | undefined;
  /**
   * The databases list.
   */
  readonly databases: Database[];
  /**
   * A signal emitting when the databases are updated.
   */
  readonly databaseUpdated: ISignal<this, Database[]>;
}

/**
 * The side panel containing the list of the databases.
 */
export class DatabasesPanel extends SidePanel implements IDatabasesPanel {
  /**
   * Constructor of the databases list.
   */
  constructor(options: DatabasesPanel.IOptions) {
    super({ translator: options.translator });
    this.id = 'jp-sql-cell-sidebar';
    this.addClass(DATABASES_CLASS);
    this.title.icon = databaseIcon;
    this.title.caption = 'Databases';

    requestAPI<Database.Description[]>('databases')
      .then(data => {
        data.forEach(database => {
          this._databases.push(new Database({ database }));
        });
        this._buildDatabaseSections(this._databases);
      })
      .catch(reason => {
        console.error(reason);
      });

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToogled, this);
  }

  /**
   * Get a database from its alias.
   */
  get_database(alias: string): Database | undefined {
    return this._databases.find(db => db.alias === alias);
  }
  /**
   * Get the databases list.
   */
  get databases(): Database[] {
    return this._databases;
  }

  /**
   * A signal emitting when the databases are updated.
   */
  get databaseUpdated(): ISignal<this, Database[]> {
    return this._databasesUpdated;
  }

  /**
   * Build the database sections.
   *
   * @param databases - the databases description.
   * @param tracker - the notebook tracker.
   */
  private _buildDatabaseSections(databases: Database[]) {
    const content = this.content as AccordionPanel;
    databases.forEach(database => {
      this.addWidget(new DatabaseSection({ database }));
      content.collapse(content.widgets.length - 1);
    });
  }

  /**
   * Triggered when the section is expanded.
   */
  private _onExpansionToogled(_: AccordionPanel, index: number) {
    const section = this.widgets[index] as DatabaseSection;
    if (section.isVisible) {
      section.onExpand();
    }
  }

  private _databasesUpdated = new Signal<this, Database[]>(this);
  private _databases: Database[] = [];
}

/**
 * Namespace for the databases side panel.
 */
export namespace DatabasesPanel {
  /**
   * Options of the databases side panel's constructor.
   */
  export interface IOptions {
    /**
     * The translator.
     */
    translator: ITranslator;
  }
}

/**
 * The database section containing the list of the tables.
 */
class DatabaseSection extends PanelWithToolbar {
  constructor(options: DatabaseSection.IOptions) {
    super(options);
    this._database = options.database;
    this.addClass(DATABASE_CLASS);
    this.title.label = this._database.alias;
    this.title.caption = this._database.text();
    this.toolbar.addClass(TOOLBAR_CLASS);

    const deleteButton = new ToolbarButton({
      icon: deleteIcon,
      className: 'jp-mod-styled',
      onClick: () => {
        console.log('should remove the database');
      }
    });
    this.toolbar.addItem('SqlCell-database-delete', deleteButton);

    this._body = new TablesList({ database_id: this._database.id });
    this._body.addClass(DATABASE_BODY_CLASS);
    this.addWidget(this._body);
  }

  /**
   * request the server to get the table list on first expand.
   */
  onExpand() {
    if (!this._tables.length) {
      const searchParams = new URLSearchParams({
        id: this._database.id.toString(),
        target: 'tables'
      });
      requestAPI<any>(`schema?${searchParams.toString()}`)
        .then(response => {
          this._tables = (response as DatabaseSection.IDatabaseSchema).data;
          this._body.updateTables(this._tables);
        })
        .catch(reason => {
          console.error(reason);
        });
    }
  }

  private _database: Database;
  private _body: TablesList;
  private _tables: string[] = [];
}

/**
 * Namespace for the database section.
 */
namespace DatabaseSection {
  /**
   * Options for the DatabaseSection constructor.
   */
  export interface IOptions extends Panel.IOptions {
    /**
     * The database description.
     */
    database: Database;
  }

  /**
   * Schema object returned from server request.
   */
  export interface IDatabaseSchema {
    data: string[];
    id: number;
    table: string;
    target: 'tables' | 'columns';
  }
}

/**
 * The tables list.
 */
class TablesList extends ReactWidget {
  /**
   * Constructor of the tables list.
   * @param options - contains the database_id.
   */
  constructor(options: { database_id: number }) {
    super();
    this._database_id = options.database_id;
  }

  updateTables(tables: string[]) {
    this._update.emit(tables);
  }

  render(): JSX.Element {
    const database_id = this._database_id;
    return (
      <ul className={TABLE_ITEMS_CLASS}>
        <UseSignal signal={this._update}>
          {(_, tables) => {
            return tables?.map(table => (
              <Table database_id={database_id} name={table} />
            ));
          }}
        </UseSignal>
      </ul>
    );
  }

  private _database_id: number;
  private _update: Signal<TablesList, string[]> = new Signal(this);
}

/**
 * The table item.
 *
 * @param database_id - the id of the database to which this table belongs.
 * @param name - the name of the table.
 */
const Table = ({
  database_id,
  name
}: {
  database_id: number;
  name: string;
}): JSX.Element => {
  const expandedClass = 'lm-mod-expanded';
  const [columns, updateColumns] = React.useState<string[]>([]);
  const [expanded, expand] = React.useState(false);

  /**
   * Handle the click on the table name.
   *
   * @param event - the mouse event
   */
  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLDivElement;
    if (expanded) {
      target.classList.remove(expandedClass);
      updateColumns([]);
      expand(false);
    } else {
      target.classList.add(expandedClass);
      const searchParams = new URLSearchParams({
        id: database_id.toString(),
        table: name,
        target: 'columns'
      });
      requestAPI<any>(`schema?${searchParams.toString()}`)
        .then(response => {
          updateColumns((response as DatabaseSection.IDatabaseSchema).data);
          expand(true);
        })
        .catch(reason => {
          console.error(reason);
        });
    }
  };

  return (
    <li>
      <div
        className={TABLE_TITLE_CLASS}
        onClick={handleClick}
        aria-expanded={expanded ? 'true' : 'false'}
      >
        {expanded ? (
          <caretDownIcon.react tag="span" />
        ) : (
          <caretRightIcon.react tag="span" />
        )}
        <tableRowsIcon.react tag="span" elementSize="small" />
        {name}
      </div>
      <ColumnsList columns={columns} />
    </li>
  );
};

/**
 * The columns list.
 *
 * @param columns - the list of columns name.
 * @returns
 */
const ColumnsList = ({ columns }: { columns: string[] }): JSX.Element => {
  return (
    <ul
      className={COLUMN_ITEMS_CLASS + (columns.length ? '' : ' lm-mod-hidden')}
      role="region"
    >
      {columns.map(column => (
        <li>{column}</li>
      ))}
    </ul>
  );
};
