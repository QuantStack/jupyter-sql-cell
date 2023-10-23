import { Parser } from '@json2csv/plainjs';
import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  ISessionContext,
  ISessionContextDialogs,
  IToolbarWidgetRegistry
} from '@jupyterlab/apputils';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import {
  INotebookTracker,
  Notebook,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { Contents, ContentsManager } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { runIcon } from '@jupyterlab/ui-components';

import { CustomContentFactory } from './cellfactory';
import { requestAPI } from './handler';
import { CommandIDs, SQL_MIMETYPE, SqlCell } from './common';
import { Databases, DATABASE_METADATA } from './sidepanel';
import { SqlWidget } from './widget';

const ORIGINAL_RUN = NotebookActions.run;
const ORIGINAL_RUN_ALL = NotebookActions.runAll;
const ORIGINAL_RUN_AND_ADVANCE = NotebookActions.runAndAdvance;
const ORIGINAL_RUN_AND_INSERT = NotebookActions.runAndInsert;
const ORIGINAL_RUN_ALL_ABOVE = NotebookActions.runAllAbove;
const ORIGINAL_RUN_ALL_BELOW = NotebookActions.runAllBelow;

/**
 * The sql-cell namespace token.
 */
const namespace = 'sql-cell';

/**
 * Load the commands and the cell toolbar buttons (from settings).
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'Add the commands to the registry.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ICommandPalette, IDefaultFileBrowser],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    commandPalette: ICommandPalette,
    fileBrowser: IDefaultFileBrowser | null
  ) => {
    const { commands } = app;

    // Overwrites the core functions to execute also the SQL cells.
    NotebookActions.run = Private.run;
    NotebookActions.runAll = Private.runAll;
    NotebookActions.runAndAdvance = Private.runAndAdvance;
    NotebookActions.runAndInsert = Private.runAndInsert;
    NotebookActions.runAllAbove = Private.runAllAbove;
    NotebookActions.runAllBelow = Private.runAllBelow;

    commands.addCommand(CommandIDs.execute, {
      label: 'Run SQL',
      caption: 'Run SQL',
      icon: runIcon,
      execute: async args => {
        const path = (args?.path || '_sql_output') as string;
        const cell = (args?.cell ||
          tracker.activeCell) as Cell<ICellModel> | null;

        Private.executeSqlCell(cell, path, fileBrowser);
      },
      isEnabled: () => SqlCell.isSqlCell(tracker.activeCell?.model),
      isVisible: () => SqlCell.isRaw(tracker.activeCell?.model)
    });

    commands.addCommand(CommandIDs.switchSQL, {
      label: 'SQL',
      caption: () => {
        const model = tracker.activeCell?.model;
        return SqlCell.isRaw(model)
          ? SqlCell.isSqlCell(model)
            ? 'Switch to Raw'
            : 'Switch to SQL'
          : 'Not available';
      },
      execute: async () => {
        const model = tracker.activeCell?.model;
        if (!model || model.type !== 'raw') {
          return;
        }
        if (model.getMetadata('format') !== SQL_MIMETYPE) {
          model.setMetadata('format', SQL_MIMETYPE);
        } else if (model.getMetadata('format') === SQL_MIMETYPE) {
          model.deleteMetadata('format');
        }

        app.commands.notifyCommandChanged(CommandIDs.switchSQL);
        app.commands.notifyCommandChanged(CommandIDs.execute);
      },
      isVisible: () => SqlCell.isRaw(tracker.activeCell?.model),
      isToggled: () => SqlCell.isSqlCell(tracker.activeCell?.model)
    });

    if (commandPalette) {
      commandPalette.addItem({
        command: CommandIDs.execute,
        category: 'SQL'
      });
    }
  }
};

/**
 * The notebook cell factory provider, to handle SQL cells.
 */
const cellFactory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@jupyter/sql-cell:content-factory',
  description: 'Provides the notebook cell factory.',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new CustomContentFactory({ editorFactory });
  }
};

/**
 * The side panel to handle the list of databases.
 */
const databasesList: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:databases-list',
  description: 'The side panel which handle databases list.',
  autoStart: true,
  optional: [ILabShell, ILayoutRestorer, INotebookTracker, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    labShell: ILabShell,
    restorer: ILayoutRestorer | null,
    tracker: INotebookTracker | null,
    translator: ITranslator | null
  ) => {
    const { shell } = app;
    if (!translator) {
      translator = nullTranslator;
    }
    const panel = new Databases({ tracker, translator });

    // Restore the widget state
    if (restorer) {
      restorer.add(panel, namespace);
    }

    if (labShell) {
      labShell.currentChanged.connect(
        (_: ILabShell, args: ILabShell.IChangedArgs) => {
          panel.mainAreaWidgetChanged(args.newValue);
        }
      );
    }

    shell.add(panel, 'left');
  }
};

/**
 * The notebook toolbar widget.
 */
const notebookToolbarWidget: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:notebook-toolbar',
  description: 'A JupyterLab extension to run SQL in notebook dedicated cells',
  autoStart: true,
  requires: [INotebookTracker, IToolbarWidgetRegistry],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingRegistry: ISettingRegistry | null
  ) => {
    const { commands } = app;

    const toolbarFactory = (panel: NotebookPanel) => {
      return new SqlWidget({
        commands,
        commandID: CommandIDs.execute,
        tracker
      });
    };

    toolbarRegistry.addFactory<NotebookPanel>(
      'Notebook',
      'SqlWidget',
      toolbarFactory
    );

    if (settingRegistry) {
      settingRegistry
        .load(notebookToolbarWidget.id)
        .then(settings => {
          console.log('@jupyter/sql-cell settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error(
            'Failed to load settings for @jupyter/sql-cell.',
            reason
          );
        });
    }
  }
};

export default [cellFactory, databasesList, notebookToolbarWidget, plugin];

namespace Private {
  /**
   * Executes an SQL cell.
   *
   * @param cell - the cell to execute.
   * @param path - the path to the resulting file.
   * @param fileBrowser - the filebrowser widget (optional).
   */
  export async function executeSqlCell(
    cell: Cell<ICellModel> | null,
    path: string,
    fileBrowser: IDefaultFileBrowser | null
  ): Promise<void> {
    if (!(cell?.model.type === 'raw')) {
      return;
    }
    const database_id = cell.model.getMetadata(DATABASE_METADATA)['id'];
    if (database_id === undefined) {
      console.error('The database has not been set.');
    }

    const date = new Date();
    const source = cell?.model.sharedModel.getSource();
    requestAPI<any>('execute', {
      method: 'POST',
      body: JSON.stringify({ query: source, id: database_id })
    })
      .then(data => {
        saveData(path, data.data, date, fileBrowser)
          .then(dataPath => console.log(`Data saved ${dataPath}`))
          .catch(undefined);
      })
      .catch(reason => {
        console.error(
          `The jupyter_sql_cell server extension appears to be missing.\n${reason}`
        );
      });
  }

  /**
   * Executes all selected SQL cells in a notebook.
   *
   * @param notebook - the current notebook widget.
   */
  export function executeSelectedSqlCells(notebook: Notebook): void {
    const selected = notebook.widgets.filter((child, index) => {
      return notebook.isSelectedOrActive(child);
    });

    selected
      .filter(cell => SqlCell.isSqlCell(cell.model))
      .forEach(cell => {
        executeSqlCell(cell, '_sql_output', null);
      });
  }

  /**
   * Executes all SQL cells in a notebook.
   *
   * @param notebook - the current notebook widget.
   */
  export function executeAllSqlCells(notebook: Notebook): void {
    notebook.widgets
      .filter(cell => SqlCell.isSqlCell(cell.model))
      .forEach(cell => {
        executeSqlCell(cell, '_sql_output', null);
      });
  }

  /**
   * Executes all above SQL cells in a notebook.
   *
   * @param notebook - the current notebook widget.
   */
  export function executeAboveSqlCells(notebook: Notebook): void {
    notebook.widgets
      .slice(0, notebook.activeCellIndex)
      .filter(cell => SqlCell.isSqlCell(cell.model))
      .forEach(cell => {
        executeSqlCell(cell, '_sql_output', null);
      });
  }

  /**
   * Executes selected cell and all below SQL cells in a notebook.
   *
   * @param notebook - the current notebook widget.
   */
  export function executeBelowSqlCells(notebook: Notebook): void {
    notebook.widgets
      .slice(notebook.activeCellIndex, notebook.widgets.length)
      .filter(cell => SqlCell.isSqlCell(cell.model))
      .forEach(cell => {
        executeSqlCell(cell, '_sql_output', null);
      });
  }

  /**
   * Run the selected cell(s).
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function run(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeSelectedSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN(notebook, sessionContext, sessionDialogs, translator);
  }

  /**
   * Run all of the cells in the notebook.
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function runAll(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeAllSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN_ALL(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );
  }

  /**
   * Run the selected cell(s) and advance to the next cell.
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function runAndAdvance(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeSelectedSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN_AND_ADVANCE(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );
  }

  /**
   * Run the selected cell(s) and insert a new code cell.
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function runAndInsert(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeSelectedSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN_AND_INSERT(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );
  }

  /**
   * Run all of the cells before the currently active cell (exclusive).
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function runAllAbove(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeAboveSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN_ALL_ABOVE(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );
  }

  /**
   * Run all of the cells after the currently active cell (inclusive).
   *
   * @param notebook - The target notebook widget.
   * @param sessionContext - The client session object.
   * @param sessionDialogs - The session dialogs.
   * @param translator - The application translator.
   *
   * NOTES:
   * This function overwrites the core jupyterlab function.
   */
  export function runAllBelow(
    notebook: Notebook,
    sessionContext?: ISessionContext,
    sessionDialogs?: ISessionContextDialogs,
    translator?: ITranslator
  ): Promise<boolean> {
    // Execute first all the SQL cells.
    executeBelowSqlCells(notebook);

    // Execute the remaining selected cells using the original run command,
    // which doesn't take into account the raw cells
    return ORIGINAL_RUN_ALL_BELOW(
      notebook,
      sessionContext,
      sessionDialogs,
      translator
    );
  }

  /**
   * Save data in a CSV file.
   *
   * @param path - the path to the directory where to save data.
   * @param data - the data to parse as CSV.
   * @param date - the query date.
   */
  export async function saveData(
    path: string,
    data: any,
    date: Date,
    fileBrowser: IDefaultFileBrowser | null
  ): Promise<string | undefined> {
    const contentsManager = new ContentsManager();
    const parser = new Parser();
    const csv = parser.parse(data);

    const dateText = date.toISOString().replace(/[/:]/g, '-');

    let currentPath = '';
    if (!path.startsWith('/')) {
      currentPath = `${fileBrowser?.model.path || ''}/` || '';
    }

    for (const directory of path.split('/')) {
      currentPath = `${currentPath}${directory}/`;
      await contentsManager
        .get(currentPath, { content: false })
        .catch(error =>
          contentsManager.save(currentPath, { type: 'directory' })
        );
    }

    const filename = `${dateText}.csv`;
    const fileModel = {
      name: filename,
      path: `${currentPath}/${filename}`,
      format: 'text' as Contents.FileFormat,
      content: csv
    };

    return contentsManager
      .save(fileModel.path, fileModel)
      .then(() => {
        return fileModel.path;
      })
      .catch(e => {
        console.error(e);
        return undefined;
      });
  }
}
