import { Parser } from '@json2csv/plainjs';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Contents, ContentsManager } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { runIcon } from '@jupyterlab/ui-components';

import { requestAPI } from './handler';
import { METADATA_SQL_FORMAT, SqlWidget } from './widget';

/**
 * Initialization data for the @jupyter/sql-cell extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'A JupyterLab extension to run SQL in notebook dedicated cells',
  autoStart: true,
  requires: [INotebookTracker, IToolbarWidgetRegistry],
  optional: [ICommandPalette, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    toolbarRegistry: IToolbarWidgetRegistry,
    commandPalette: ICommandPalette | null,
    settingRegistry: ISettingRegistry | null
  ) => {
    const { commands } = app;

    const commandID = 'jupyter-sql-cell:execute';

    commands.addCommand(commandID, {
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
            saveData(path, data.data, date)
              .then(dataPath => console.log(`Data saved ${dataPath}`))
              .catch(undefined);
          })
          .catch(reason => {
            console.error(
              `The jupyter_sql_cell server extension appears to be missing.\n${reason}`
            );
          });
      },
      isEnabled: () => {
        const model = tracker.activeCell?.model;
        if (!model) {
          return false;
        }
        return (
          model.type === 'raw' &&
          model.getMetadata('format') === METADATA_SQL_FORMAT
        );
      }
    });

    const toolbarFactory = (panel: NotebookPanel) => {
      return new SqlWidget({ commands, commandID, tracker });
    };

    toolbarRegistry.addFactory<NotebookPanel>(
      'Notebook',
      'SqlWidget',
      toolbarFactory
    );

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
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

    if (commandPalette) {
      commandPalette.addItem({
        command: commandID,
        category: 'SQL'
      });
    }

    console.log('JupyterLab extension @jupyter/sql-cell is activated!');
  }
};

export default plugin;

/**
 * Save data in a CSV file.
 *
 * @param path - the path to the directory where to save data.
 * @param data - the data to parse as CSV.
 * @param date - the query date.
 */
async function saveData(
  path: string,
  data: any,
  date: Date
): Promise<string | undefined> {
  const contentsManager = new ContentsManager();
  const parser = new Parser();
  const csv = parser.parse(data);

  const dateText = date
    .toLocaleString()
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '')
    .replace(',', '_');

  const filename = `${dateText}.csv`;
  const fileModel = {
    name: filename,
    path: `${path}/${filename}`,
    format: 'text' as Contents.FileFormat,
    content: csv
  };

  let currentPath = '';
  for (const directory of path.split('/')) {
    currentPath = `${currentPath}${directory}/`;
    await contentsManager
      .get(currentPath, { content: false })
      .catch(() => contentsManager.save(currentPath, { type: 'directory' }));
  }

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
