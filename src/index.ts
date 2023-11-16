import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { NotebookContentFactory } from './cellfactory';
import { Databases, IDatabasesPanel } from './sidepanel';

/**
 * The sql-cell namespace token.
 */
const namespace = 'sql-cell';

/**
 * The side panel to handle the list of databases.
 */
const plugin: JupyterFrontEndPlugin<IDatabasesPanel> = {
  id: '@jupyter/sql-cell:plugin',
  description: 'The side panel which handle databases list.',
  autoStart: true,
  optional: [ILayoutRestorer, ISettingRegistry, ITranslator],
  provides: IDatabasesPanel,
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer | null,
    settingRegistry: ISettingRegistry | null,
    translator: ITranslator | null
  ): IDatabasesPanel => {
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
    return panel;
  }
};

/**
 * The notebook cell factory provider, to add a custom header to the code cells.
 */
const NotebookFactory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@jupyter/sql-cell:content-factory',
  description: 'Provides the notebook content factory.',
  provides: NotebookPanel.IContentFactory,
  requires: [IDatabasesPanel, IEditorServices],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    databasesPanel: IDatabasesPanel,
    editorServices: IEditorServices
  ) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new NotebookContentFactory({ databasesPanel, editorFactory });
  }
};

export default [NotebookFactory, plugin];
