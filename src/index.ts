import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { requestAPI } from './handler';
import { Databases } from './sidepanel';

/**
 * The sql-cell namespace token.
 */
const namespace = 'sql-cell';

/**
 * Initialization data for the @jupyter/sql-cell extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'A JupyterLab extension to run SQL in notebook dedicated cells',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension @jupyter/sql-cell is activated!');

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

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyter_sql_cell server extension appears to be missing.\n${reason}`
        );
      });
  }
};

/**
 * The side panel to handle the list of databases.
 */
const databasesPanel: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:databases-panel',
  description: 'The side panel which handle databases list.',
  autoStart: true,
  optional: [ILabShell, ILayoutRestorer, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    labShell: ILabShell,
    restorer: ILayoutRestorer | null,
    translator: ITranslator | null
  ) => {
    const { shell } = app;
    if (!translator) {
      translator = nullTranslator;
    }
    const panel = new Databases({ translator });

    // Restore the widget state
    if (restorer) {
      restorer.add(panel, namespace);
    }

    shell.add(panel, 'left');
  }
};

export default [plugin, databasesPanel];
