import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISessionContext } from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage, Session } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { NotebookContentFactory } from './cellfactory';
import { LOAD_MAGIC } from './common';
import { IKernelInjection, KernelInjection } from './kernelInjection';
import { DatabasesPanel, IDatabasesPanel } from './sidepanel';

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
    const panel = new DatabasesPanel({ translator });

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
const notebookFactory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@jupyter/sql-cell:content-factory',
  description: 'Provides the notebook content factory.',
  provides: NotebookPanel.IContentFactory,
  requires: [IDatabasesPanel, IEditorServices, IKernelInjection],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    databasesPanel: IDatabasesPanel,
    editorServices: IEditorServices,
    kernelInjection: IKernelInjection
  ) => {
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new NotebookContentFactory({
      databasesPanel,
      editorFactory,
      kernelInjection
    });
  }
};

/**
 * A plugin to provides the kernel injection status.
 */
const kernelInjection: JupyterFrontEndPlugin<IKernelInjection> = {
  id: '@jupyter/sql-cell:kernel-injection',
  description: 'A JupyterLab extension to provide the kernel injection status',
  autoStart: true,
  provides: IKernelInjection,
  activate: (app: JupyterFrontEnd): IKernelInjection => {
    return new KernelInjection();
  }
};

/*
 * A plugin to inject a function in the notebook kernel.
 *
 * ### NOTES:
 * This plugin must be separated from 'kernelInjection' to avoid cycle dependencies.
 * Indeed, this plugin requires 'INotebookTracker', which requires
 * 'NotebookPanel.IContentFactory'.
 * However, the custom 'NotebookPanel.IContentFactory', provided here in
 * 'notebookFactory', requires 'kernelInjection'.
 */
const kernelInjector: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:kernel-injector',
  description: 'A JupyterLab extension to inject code in notebook kernel',
  autoStart: true,
  requires: [IKernelInjection, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    kernelInjection: IKernelInjection,
    tracker: INotebookTracker
  ) => {
    let sessionContext: ISessionContext | undefined = undefined;

    /**
     * Triggered when the current notebook or current kernel changes.
     */
    const onKernelChanged = async (
      _sessionContext: ISessionContext,
      kernelChange: Session.ISessionConnection.IKernelChangedArgs
    ) => {
      kernelInjection.status = false;
      const kernel = kernelChange.newValue;
      if (kernel) {
        kernel.info.then(info => {
          const code = LOAD_MAGIC;
          const content: KernelMessage.IExecuteRequestMsg['content'] = {
            code,
            store_history: false
          };
          const future = kernel.requestExecute(content);
          future.done.then(reply => {
            kernelInjection.status = reply.content.status === 'ok';
            if (!(reply.content.status === 'ok')) {
              console.warn('The kernel does not support SQL magics');
            }
          });
        });
      }
    };

    tracker.currentChanged.connect((_, panel) => {
      sessionContext?.kernelChanged.disconnect(onKernelChanged);
      sessionContext = panel?.sessionContext;
      const kernel = sessionContext?.session?.kernel;
      if (sessionContext && kernel) {
        onKernelChanged(sessionContext, {
          name: 'kernel',
          oldValue: null,
          newValue: kernel
        });
      }
      sessionContext?.kernelChanged.connect(onKernelChanged);
    });
  }
};

export default [kernelInjection, kernelInjector, notebookFactory, plugin];
