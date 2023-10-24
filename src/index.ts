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
  IToolbarWidgetRegistry
} from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { IMetadataFormProvider } from '@jupyterlab/metadataform';
import {
  INotebookTracker,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import {
  Contents,
  ContentsManager,
  Kernel,
  KernelMessage,
  Session
} from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import {
  IFormRenderer,
  IFormRendererRegistry,
  runIcon
} from '@jupyterlab/ui-components';
import { PartialJSONObject } from '@lumino/coreutils';
import { FieldProps } from '@rjsf/utils';

import { CustomContentFactory } from './cellfactory';
import { requestAPI } from './handler';
import { CommandIDs, SQL_MIMETYPE, SqlCell, objectEnum } from './common';
import * as injectCode from './injectedCode';
import { ISqlCellInjection, SqlCellInjection } from './kernelInjection';
import { Databases } from './sidepanel';
import { DatabaseSelect, SqlWidget, SqlSwitchWidget } from './widget';

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
  requires: [INotebookTracker, ISqlCellInjection],
  optional: [ICommandPalette, IDefaultFileBrowser],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    injection: ISqlCellInjection,
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
        const database_id = SqlCell.getMetadata(activeCell.model, 'database')[
          'id'
        ];

        if (database_id === undefined) {
          console.error('The database has not been set.');
        }
        const date = new Date();
        const kernel = tracker.currentWidget?.sessionContext.session?.kernel;
        const source = activeCell?.model.sharedModel.getSource();
        requestAPI<any>('execute', {
          method: 'POST',
          body: JSON.stringify({ query: source, id: database_id })
        })
          .then(data => {
            if (kernel && injection.status) {
              const future = Private.transferDataToKernel(kernel, data.data);
              future.done.then(reply => {
                console.log('REPLY', reply);
              });
            } else {
              Private.saveData(path, data.data, date, fileBrowser)
                .then(dataPath => console.log(`Data saved ${dataPath}`))
                .catch(undefined);
            }
          })
          .catch(reason => {
            console.error(reason);
          });
      },
      isEnabled: () => SqlCell.isSqlCell(tracker.activeCell?.model),
      isVisible: () => SqlCell.isRaw(tracker.activeCell?.model)
    });

    commands.addCommand(CommandIDs.switchSQL, {
      label: 'SQL',
      caption: () => {
        const model = tracker.activeCell?.model;
        return SqlCell.isSqlCell(model) ? 'Switch to Raw' : 'Switch to SQL';
      },
      execute: async () => {
        const notebook = tracker.currentWidget?.content;
        let model = tracker.activeCell?.model;
        if (!notebook || !model) {
          return;
        }
        if (model.type !== 'raw') {
          NotebookActions.changeCellType(notebook, 'raw');
          // Reassign the model since the cell has been deleted and created again.
          model = tracker.activeCell?.model;
        }
        if (model?.getMetadata('format') !== SQL_MIMETYPE) {
          model?.setMetadata('format', SQL_MIMETYPE);
        } else if (model?.getMetadata('format') === SQL_MIMETYPE) {
          model?.deleteMetadata('format');
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
  optional: [
    ILabShell,
    ILayoutRestorer,
    IMetadataFormProvider,
    INotebookTracker,
    ITranslator
  ],
  activate: (
    app: JupyterFrontEnd,
    labShell: ILabShell,
    restorer: ILayoutRestorer | null,
    metadataForms: IMetadataFormProvider | null,
    tracker: INotebookTracker | null,
    translator: ITranslator | null
  ) => {
    const { shell } = app;
    if (!translator) {
      translator = nullTranslator;
    }
    const panel = new Databases({ tracker, translator });

    if (metadataForms) {
      // Update the databases list in the metadata form.
      panel.databaseUpdated.connect((_, databases) => {
        const properties: PartialJSONObject = { oneOf: [] };
        (properties!.oneOf as objectEnum[])!.push({
          const: null,
          title: '-'
        });
        databases.forEach(db => {
          const dbJson = JSON.parse(JSON.stringify(db));
          (properties!.oneOf as objectEnum[])!.push({
            const: dbJson,
            title: db.alias
          });
        });
        metadataForms
          .get('sqlCellSection')!
          .setProperties('/sql-cell/database', properties);
      });
    }

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
 * The plugin to add a form interacting with cell metadata, in the notebook tools.
 */
const metadataForm: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:metadata-form',
  description:
    'A JupyterLab extension to add a form in the Notebook tools panel.',
  autoStart: true,
  requires: [IFormRendererRegistry, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    formRegistry: IFormRendererRegistry,
    tracker: INotebookTracker
  ) => {
    const { commands } = app;

    // The widget to toggle to SQL cell.
    const switcher: IFormRenderer = {
      fieldRenderer: () => {
        return SqlSwitchWidget({
          commands,
          tracker
        });
      }
    };
    formRegistry.addRenderer('@jupyter/sql-cell:switch.renderer', switcher);

    // A widget to associate a database to the cell.
    const databaseSelect: IFormRenderer = {
      fieldRenderer: (props: FieldProps) => {
        return DatabaseSelect({ ...props, tracker });
      }
    };
    formRegistry.addRenderer(
      '@jupyter/sql-cell:database-select.renderer',
      databaseSelect
    );
  }
};

/*
 * A plugin to inject a function in the notebook kernel.
 */
const kernelFunctionInjector: JupyterFrontEndPlugin<ISqlCellInjection> = {
  id: '@jupyter/sql-cell:kernel-injection',
  description: 'A JupyterLab extension to inject a function in notebook kernel',
  autoStart: true,
  provides: ISqlCellInjection,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    let sessionContext: ISessionContext | undefined = undefined;
    const injection = new SqlCellInjection();

    /**
     * Triggered when the current notebook or current kernel changes.
     */
    const onKernelChanged = async (
      _sessionContext: ISessionContext,
      kernelChange: Session.ISessionConnection.IKernelChangedArgs
    ) => {
      injection.status = false;
      const kernel = kernelChange.newValue;
      if (kernel) {
        kernel.info.then(info => {
          let code = '';
          if (info.language_info.name === 'python') {
            code = injectCode.PYTHON_CODE;
          }
          if (!code) {
            return;
          }
          const content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: code
          };
          const future = kernel.requestExecute(content);
          future.done.then(reply => {
            injection.status = reply.content.status === 'ok';
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

    return injection;
  }
};

/**
 * The notebook toolbar widget.
 */
const notebookToolbarWidget: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/sql-cell:notebook-toolbar',
  description: 'A JupyterLab extension to add a widget in the Notebook toolbar',
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
      return new SqlWidget({ commands, tracker });
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

export default [
  cellFactory,
  databasesList,
  metadataForm,
  kernelFunctionInjector,
  notebookToolbarWidget,
  plugin
];

namespace Private {
  /**
   * Call the function to transfer the data on the kernel.
   *
   * @param kernel - kernel on which to transfer the data.
   * @param data - data to transfer to the kernel (mst be serializable).
   * @returns the code execution future.
   */
  export function transferDataToKernel(
    kernel: Kernel.IKernelConnection,
    data: any
  ): Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > {
    data = JSON.stringify(data).replace(/"/gi, '\\"');
    const code = `_sql_transfer_data("${data}")`;
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: code,
      stop_on_error: true
    };
    return kernel.requestExecute(content, false);
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
