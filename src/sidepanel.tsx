import { Cell, ICellModel } from '@jupyterlab/cells';
import { INotebookTracker } from '@jupyterlab/notebook';
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
import { Signal } from '@lumino/signaling';
import { AccordionPanel, Panel, Widget } from '@lumino/widgets';
import * as React from 'react';

import { SqlCell } from './common';
import { requestAPI } from './handler';
import databaseSvgstr from '../style/icons/database.svg';

/**
 * The metadata key to store the database.
 */
export const DATABASE_METADATA = 'sqlcell-database';

/**
 * The class of the side panel.
 */
const DATABASES_CLASS = 'jp-SqlCell-DatabasesPanel';
/**
 * The class of the side panel.
 */
const DATABASE_CLASS = 'jp-SqlCell-database';
/**
 * The class of the database toolbar.
 */
const TOOLBAR_CLASS = 'jp-SqlCell-database-toolbar';
/**
 * The class of the button in database toolbar.
 */
const SELECT_BUTTON_CLASS = 'jp-SqlCell-database-selectButton';
/**
 * The class of the body of the database.
 */
const DATABASE_BODY_CLASS = 'jp-SqlCell-database-body';
/**
 * The class of tables list.
 */
const TABLE_ITEMS_CLASS = 'jp-SqlCell-table-items';
/**
 * The class of table name.
 */
const TABLE_TITLE_CLASS = 'jp-SqlCell-table-title';
/**
 * The class of the column item.
 */
const COLUMN_ITEMS_CLASS = 'jp-SqlCell-column-items';

/**
 * The database icon.
 */
const databaseIcon = new LabIcon({
  name: 'sql-cell:database',
  svgstr: databaseSvgstr
});

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
    this.title.icon = databaseIcon;
    this.title.caption = 'Databases';
    this._tracker = options.tracker;

    requestAPI<any>('databases')
      .then(data => {
        this._buildDatabaseSections(data, options.tracker);
      })
      .catch(reason => {
        console.error(reason);
      });

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToogled, this);
    this._tracker?.activeCellChanged.connect(this.activeCellChanged, this);
  }

  /**
   * Triggered when the main area widget changes.
   *
   * @param widget - the current main area widget.
   */
  mainAreaWidgetChanged(widget: Widget | null) {
    if (widget && widget === this._tracker?.currentWidget) {
      if (!this._isNotebook) {
        this._isNotebook = true;
        this.updateSelectButtons(this._tracker?.activeCell?.model);
      }
    } else {
      if (this._isNotebook) {
        this._isNotebook = false;
        this.updateSelectButtons(this._tracker?.activeCell?.model);
      }
    }
  }

  /**
   * Triggered when the active cell changes.
   */
  activeCellChanged = (_: INotebookTracker, cell: Cell<ICellModel> | null) => {
    this._currentCell?.model.metadataChanged.disconnect(
      this.cellMetadataChanged,
      this
    );

    this._currentCell = cell;
    this.updateSelectButtons(cell?.model);

    this._currentCell?.model.metadataChanged.connect(
      this.cellMetadataChanged,
      this
    );
  };

  /**
   * Triggered when the active cell metadata changes.
   */
  cellMetadataChanged = (cellModel: ICellModel) => {
    this.updateSelectButtons(cellModel);
  };

  /**
   * Updates the status of the toolbar button to select the cell database.
   *
   * @param cellModel - the active cell model.
   */
  updateSelectButtons = (cellModel: ICellModel | undefined) => {
    const enabled = this._isNotebook && SqlCell.isSqlCell(cellModel);
    this.widgets.forEach(widget => {
      (widget as DatabaseSection).updateSelectButton(
        this._isNotebook,
        enabled,
        cellModel
      );
    });
  };

  /**
   * Build the database sections.
   *
   * @param databases - the databases description.
   * @param tracker - the notebook tracker.
   */
  private _buildDatabaseSections(
    databases: Databases.IDatabase[],
    tracker: INotebookTracker | null
  ) {
    const content = this.content as AccordionPanel;
    databases.forEach(database => {
      this.addWidget(new DatabaseSection({ database, tracker }));
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

  private _isNotebook: boolean = false;
  private _tracker: INotebookTracker | null;
  private _currentCell: Cell<ICellModel> | null = null;
}

/**
 * Namespace for the databases side panel.
 */
namespace Databases {
  /**
   * Options of the databases side panel's constructor.
   */
  export interface IOptions {
    /**
     * The notebook tracker.
     */
    tracker: INotebookTracker | null;
    /**
     * The translator.
     */
    translator: ITranslator;
  }

  /**
   * Database object returned from server request.
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

/**
 * The database section containing the list of the tables.
 */
class DatabaseSection extends PanelWithToolbar {
  constructor(options: DatabaseSection.IOptions) {
    super(options);
    this._database = options.database;
    this._tracker = options.tracker;
    this.addClass(DATABASE_CLASS);
    this.title.label = this._database.alias;
    this.title.caption = this._tooltip();
    this.toolbar.addClass(TOOLBAR_CLASS);

    this._selectButton = new ToolbarButton({
      label: 'SELECT',
      className: `${SELECT_BUTTON_CLASS} jp-mod-styled`,
      enabled: SqlCell.isSqlCell(this._tracker?.activeCell?.model),
      onClick: () => {
        const model = this._tracker?.activeCell?.model;
        if (this._selectButton.pressed) {
          model?.deleteMetadata(DATABASE_METADATA);
          this.updateSelectButton(true, true, model);
        } else if (model && SqlCell.isSqlCell(model)) {
          model.setMetadata(DATABASE_METADATA, this._database);
          (this.parent?.parent as Databases)?.updateSelectButtons(
            this._tracker?.activeCell?.model
          );
        }
      }
    });
    this.toolbar.addItem('SqlCell-database-select', this._selectButton);

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
   * Update the select button status.
   *
   * @param enabled - whether the button is enabled or not.
   * @param cellModel - the active cell model.
   */
  updateSelectButton(
    visible: boolean,
    enabled: boolean,
    cellModel: ICellModel | undefined
  ) {
    const button = this._selectButton;

    if (visible) {
      button.removeClass('lm-mod-hidden');
    } else {
      button.addClass('lm-mod-hidden');
    }

    button.enabled = enabled;
    const metadata = cellModel?.getMetadata(DATABASE_METADATA);
    button.pressed = Private.databaseMatch(this._database, metadata);

    // FIXME: should be implemented in ToolbarButton.
    button.node.ariaPressed = button.pressed.toString();
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

  /**
   * Build the tooltip text of the toolbar.
   */
  private _tooltip() {
    let tooltip = '';
    let key: keyof Databases.IDatabase;
    for (key in this._database) {
      tooltip = tooltip + `${key}: ${this._database[key]?.toString()}\n`;
    }
    return tooltip;
  }

  private _database: Databases.IDatabase;
  private _tracker: INotebookTracker | null;
  private _body: TablesList;
  private _tables: string[] = [];
  private _selectButton: ToolbarButton;
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
    database: Databases.IDatabase;
    /**
     * The notebook tracker.
     */
    tracker: INotebookTracker | null;
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
      <div className={TABLE_TITLE_CLASS} onClick={handleClick}>
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
    >
      {columns.map(column => (
        <li>{column}</li>
      ))}
    </ul>
  );
};

namespace Private {
  export function databaseMatch(
    db1: Databases.IDatabase,
    db2: Databases.IDatabase
  ): boolean {
    if (!db1 || !db2) {
      return false;
    }

    const keys1 = Object.keys(db1);
    const keys2 = Object.keys(db2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (
        db1[key as keyof Databases.IDatabase] !==
        db2[key as keyof Databases.IDatabase]
      ) {
        return false;
      }
    }

    return true;
  }
}
