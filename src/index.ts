import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { runIcon } from '@jupyterlab/ui-components';

import { requestAPI } from './handler';
import { SqlWidget } from './widget';

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
      execute: () => {
        const activeCell = tracker.activeCell;

        if (!(activeCell?.model.type === 'raw')) {
          return;
        }

        const source = activeCell?.model.sharedModel.getSource();
        requestAPI<any>('execute', {
          method: 'POST',
          body: JSON.stringify({ query: source })
        })
          .then(data => {
            console.log(data);
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
        return model.type === 'raw' && model.getMetadata('sql-cell');
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
