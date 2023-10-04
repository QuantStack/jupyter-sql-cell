import { Parser } from '@json2csv/plainjs';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Contents, ContentsManager } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { runIcon } from '@jupyterlab/ui-components';

import { requestAPI } from './handler';
import { CommandIDs, METADATA_SQL_FORMAT, SqlCell } from './common';
import { SqlWidget } from './widget';

/**
 * Load the commands and the cell toolbar buttons (from settings).
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'Add the commands to the registry.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ICommandPalette, IDefaultFileBrowser],
  activate: async (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    commandPalette: ICommandPalette,
    fileBrowser: IDefaultFileBrowser | null
  ) => {
    const { commands } = app;

    commands.addCommand(CommandIDs.run, {
      label: 'Run SQL',
      caption: 'Run SQL',
      icon: runIcon,
      execute: async args => {
        const path = (args?.path || '_sql_output') as string;

        const activeCell = tracker.activeCell;

        if (!(activeCell?.model.type === 'raw')) {
          return;
        }
        const date = new Date();
        const source = activeCell?.model.sharedModel.getSource();
        requestAPI<any>('execute', {
          method: 'POST',
          body: JSON.stringify({ query: source })
        })
          .then(data => {
            Private.saveData(path, data.data, date, fileBrowser)
              .then(dataPath => console.log(`Data saved ${dataPath}`))
              .catch(undefined);
          })
          .catch(reason => {
            console.error(
              `The jupyter_sql_cell server extension appears to be missing.\n${reason}`
            );
          });
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
        if (model.getMetadata('format') !== METADATA_SQL_FORMAT) {
          model.setMetadata('format', METADATA_SQL_FORMAT);
        } else if (model.getMetadata('format') === METADATA_SQL_FORMAT) {
          model.deleteMetadata('format');
        }
        app.commands.notifyCommandChanged(CommandIDs.switchSQL);
        app.commands.notifyCommandChanged(CommandIDs.run);
      },
      isVisible: () => SqlCell.isRaw(tracker.activeCell?.model),
      isToggled: () => SqlCell.isSqlCell(tracker.activeCell?.model)
    });

    if (commandPalette) {
      commandPalette.addItem({
        command: CommandIDs.run,
        category: 'SQL'
      });
    }
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
      return new SqlWidget({ commands, commandID: CommandIDs.run, tracker });
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

export default [notebookToolbarWidget, plugin];

namespace Private {
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

    const dateText = date
      .toLocaleString()
      .replace(/[/:]/g, '-')
      .replace(/\s/g, '')
      .replace(',', '_');

    let currentPath = '';
    if (!path.startsWith('/')) {
      currentPath = `${fileBrowser?.model.path}/` || '';
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
