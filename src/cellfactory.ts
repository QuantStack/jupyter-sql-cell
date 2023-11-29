import { CellChange, ISharedCodeCell } from '@jupyter/ydoc';
import { Cell, CodeCell, ICellHeader, ICellModel } from '@jupyterlab/cells';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { ReactWidget, ReactiveToolbar } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { SingletonLayout, Widget } from '@lumino/widgets';

import { MAGIC } from './common';
import { IKernelInjection } from './kernelInjection';
import { IDatabasesPanel } from './sidepanel';
import { DatabaseSelect, variableName } from './widgets';

/**
 * The class of the header.
 */
const HEADER_CLASS = 'jp-sqlcell-header';

/**
 * The notebook content factory.
 */
export class NotebookContentFactory
  extends Notebook.ContentFactory
  implements NotebookPanel.IContentFactory
{
  constructor(options: ContentFactory.IOptions) {
    super(options);
    this._databasesPanel = options.databasesPanel;
    this._kernelInjection = options.kernelInjection;
  }

  /**
   * Create a new content area for the panel.
   */
  createNotebook(options: Notebook.IOptions): Notebook {
    return new Notebook(options);
  }

  /**
   * Creates a new code cell widget, using a custom content factory.
   */
  createCodeCell(options: CodeCell.IOptions): CodeCell {
    const editorFactory = options.contentFactory.editorFactory;
    const databasesPanel = this._databasesPanel;
    const kernelInjection = this._kernelInjection;
    const cellContentFactory = new CellContentFactory({
      databasesPanel,
      editorFactory,
      kernelInjection
    });
    const cell = new CustomCodeCell({
      ...options,
      contentFactory: cellContentFactory,
      kernelInjection
    }).initializeState();
    return cell;
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
}

/**
 * A custom code cell to copy the output in a variable when the cell is executed.
 */
class CustomCodeCell extends CodeCell {
  constructor(options: CustomCodeCell.IOptions) {
    super(options);
    this._kernelInjection = options.kernelInjection;
  }

  /**
   * Getter and setter of the SQL status.
   */
  get isSQL(): boolean {
    return this._isSQL;
  }
  set isSQL(value: boolean) {
    this._isSQL = value;
  }

  /**
   * Set the name of the variable whose copy cell output.
   */
  set variable(name: string | null) {
    this._variable = name;
  }

  protected onStateChanged(
    model: ICellModel,
    args: IChangedArgs<any, any, string>
  ): void {
    super.onStateChanged(model, args);
    if (
      args.name === 'executionCount' &&
      args.newValue &&
      this._isSQL &&
      this._variable
    ) {
      this._kernelInjection.outputToVariable(this, this._variable);
    }
  }

  private _kernelInjection: IKernelInjection;
  private _variable: string | null = null;
  private _isSQL = false;
}

/**
 * The namespace for custom code cell.
 */
namespace CustomCodeCell {
  export interface IOptions extends CodeCell.IOptions {
    /**
     * The kernel injection, whether the kernel can handle sql magics or not.
     */
    kernelInjection: IKernelInjection;
  }
}

/**
 * The cell content factory.
 */
export class CellContentFactory
  extends Cell.ContentFactory
  implements Cell.IContentFactory
{
  /**
   * Create a content factory for a cell.
   */
  constructor(options: ContentFactory.IOptions) {
    super(options);
    this._databasesPanel = options.databasesPanel;
    this._kernelInjection = options.kernelInjection;
  }

  /**
   * Create a new cell header for the parent widget.
   */
  createCellHeader(): ICellHeader {
    const databasesPanel = this._databasesPanel;
    const kernelInjection = this._kernelInjection;
    return new CellHeader({ databasesPanel, kernelInjection });
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
}

/**
 * The cell header widget.
 */
export class CellHeader extends Widget implements ICellHeader {
  /**
   * Creates a cell header.
   */
  constructor(options: {
    databasesPanel: IDatabasesPanel;
    kernelInjection: IKernelInjection;
  }) {
    super();
    this.layout = new SingletonLayout();
    this._databasesPanel = options.databasesPanel;
    this._kernelInjection = options.kernelInjection;
    this._toolbar = new ReactiveToolbar();

    this._kernelInjection.statusChanged.connect(() => {
      this._checkSource();
    }, this);
  }

  /**
   * Set the cell model to the header.
   *
   * It adds a listener on the cell content to display or not the toolbar.
   */
  set cell(model: CustomCodeCell | null) {
    this._cell = model;
    this._cell?.model.sharedModel.changed.connect(
      this._onSharedModelChanged,
      this
    );

    const databaseSelect = new DatabaseSelect({
      cellModel: this._cell?.model,
      databasesPanel: this._databasesPanel
    });

    this._toolbar.addItem('select', databaseSelect);
    this._toolbar.addItem(
      'variable',
      ReactWidget.create(variableName(this.setVariable))
    );

    this._checkSource();
  }

  /**
   * Set the variable name where to store the output of SQL query.
   *
   * @param variable - the variable name.
   */
  setVariable = (name: string | null) => {
    if (this._cell) {
      // null if the field is empty.
      this._cell.variable = name || null;
    }
  };

  /**
   * Set the cell as SQL or not, and displaying the toolbar header.
   *
   * @param status - boolean, whether the cell is SQL or not.
   */
  private _setCellSql(status: boolean) {
    if (!this._cell) {
      return;
    }
    if (status) {
      this.addClass(HEADER_CLASS);
      (this.layout as SingletonLayout).widget = this._toolbar;
    } else {
      this.removeClass(HEADER_CLASS);
      (this.layout as SingletonLayout).removeWidget(this._toolbar);
    }
    this._cell.isSQL = status;
  }

  /**
   * Check the source of the cell for the MAGIC command, and attach or detach
   * the toolbar if necessary.
   */
  private _checkSource() {
    if (!this._kernelInjection.getStatus(this._cell)) {
      this._setCellSql(false);
      return;
    }
    const sourceStart = this._cell?.model.sharedModel.source.substring(0, 5);
    if (sourceStart === MAGIC && !this._cell?.isSQL) {
      this._setCellSql(true);
    } else if (sourceStart !== MAGIC && this._cell?.isSQL) {
      this._setCellSql(false);
    }
  }

  /**
   * Triggered when the shared model change.
   */
  private _onSharedModelChanged = (_: ISharedCodeCell, change: CellChange) => {
    if (this._kernelInjection.getStatus(this._cell) && change.sourceChange) {
      this._checkSource();
    }
  };

  /**
   * Triggered when the widget has been attached.
   */
  protected onAfterAttach(msg: Message): void {
    this.cell = this.parent as CustomCodeCell;
  }

  /**
   * Triggered before the widget is detached.
   */
  protected onBeforeDetach(msg: Message): void {
    (this.layout as SingletonLayout).removeWidget(this._toolbar);

    this._kernelInjection.statusChanged.disconnect((_, status) => {
      this._checkSource();
    }, this);

    this._cell?.model.sharedModel.changed.disconnect(
      this._onSharedModelChanged,
      this
    );
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
  private _cell: CustomCodeCell | null = null;
  private _toolbar: ReactiveToolbar;
}

/**
 * The namespace for content factory.
 */
export namespace ContentFactory {
  /**
   * The content factory options.
   */
  export interface IOptions extends Cell.ContentFactory.IOptions {
    /**
     * The databases panel, containing the known databases.
     */
    databasesPanel: IDatabasesPanel;
    /**
     * The kernel injection, whether the kernel can handle sql magics or not.
     */
    kernelInjection: IKernelInjection;
  }
}
