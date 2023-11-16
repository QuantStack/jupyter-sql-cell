import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { Databases } from './sidepanel';

/**
 * The sql-cell namespace token.
 */
const namespace = 'sql-cell';

/**
 * The side panel to handle the list of databases.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'The side panel which handle databases list.',
  autoStart: true,
  optional: [ILayoutRestorer, ISettingRegistry, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer | null,
    settingRegistry: ISettingRegistry | null,
    translator: ITranslator | null
  ) => {
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

export default [plugin];
