import { CellChange, ISharedCodeCell } from '@jupyter/ydoc';
import { Cell, CodeCell, ICellHeader, ICellModel } from '@jupyterlab/cells';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { ReactiveToolbar } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { PanelLayout, SingletonLayout, Widget } from '@lumino/widgets';

import { ICustomCodeCell, MAGIC } from './common';
import { IKernelInjection } from './kernelInjection';
import { IDatabasesPanel } from './sidepanel';
import { DatabaseSelect, VariableName } from './widgets';

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
      editorFactory
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
 * The namespace for Notebook content factory.
 */
export namespace ContentFactory {
  /**
   * The content factory options.
   */
  export interface IOptions extends CellContentFactory.IOptions {
    /**
     * The kernel injection, whether the kernel can handle sql magics or not.
     */
    kernelInjection: IKernelInjection;
  }
}

/**
 * A custom code cell to copy the output in a variable when the cell is executed.
 */
class CustomCodeCell extends CodeCell implements ICustomCodeCell {
  constructor(options: CustomCodeCell.IOptions) {
    super(options);
    this._kernelInjection = options.kernelInjection;

    this.model.sharedModel.changed.connect(this._onSharedModelChanged, this);

    this._kernelInjection.statusChanged.connect(() => {
      this._checkSource();
    }, this);
  }

  protected initializeDOM(): void {
    super.initializeDOM();
    this._header = (this.layout as PanelLayout).widgets.find(
      widget => widget instanceof CellHeader
    ) as CellHeader;

    this._header.createToolbar(this);
    this._checkSource();
  }

  /**
   * Getter and setter of the SQL status.
   */
  get isSQL(): boolean {
    return this._isSQL;
  }
  set isSQL(value: boolean) {
    this._isSQL = value;
    this._header?.setCellSql(value);
  }

  /**
   * Getter and setter of the name of the variable to copy the cell output to.
   */
  get variable(): string | null {
    return this._variable;
  }
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

  /**
   * Check the source of the cell for the MAGIC command, and attach or detach
   * the toolbar if necessary.
   */
  private _checkSource() {
    if (!this._kernelInjection.getStatus(this)) {
      this.isSQL = false;
      return;
    }
    const sourceStart = this.model.sharedModel.source.substring(0, 5);
    if (sourceStart === MAGIC && !this.isSQL) {
      this.isSQL = true;
    } else if (sourceStart !== MAGIC && this.isSQL) {
      this.isSQL = false;
    }
  }

  /**
   * Triggered when the shared model change.
   */
  private _onSharedModelChanged = (_: ISharedCodeCell, change: CellChange) => {
    if (this._kernelInjection.getStatus(this) && change.sourceChange) {
      this._checkSource();
    }
  };

  private _header: CellHeader | undefined = undefined;
  private _kernelInjection: IKernelInjection;
  private _variable: string | null = null;
  private _isSQL = false;
}

/**
 * The namespace for custom code cell.
 */
namespace CustomCodeCell {
  /**
   * The custom code cell options.
   */
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
  constructor(options: CellContentFactory.IOptions) {
    super(options);
    this._databasesPanel = options.databasesPanel;
  }

  /**
   * Create a new cell header for the parent widget.
   */
  createCellHeader(): ICellHeader {
    const databasesPanel = this._databasesPanel;
    return new CellHeader({ databasesPanel });
  }

  private _databasesPanel: IDatabasesPanel;
}

/**
 * The namespace for cell content factory.
 */
export namespace CellContentFactory {
  /**
   * The content factory options.
   */
  export interface IOptions extends Cell.ContentFactory.IOptions {
    /**
     * The databases panel, containing the known databases.
     */
    databasesPanel: IDatabasesPanel;
  }
}

/**
 * The cell header widget.
 */
export class CellHeader extends Widget implements ICellHeader {
  /**
   * Creates a cell header.
   */
  constructor(options: { databasesPanel: IDatabasesPanel }) {
    super();
    this.layout = new SingletonLayout();
    this._databasesPanel = options.databasesPanel;
    this._toolbar = new ReactiveToolbar();
  }

  /**
   * Set the cell model to the header.
   *
   * It adds a listener on the cell content to display or not the toolbar.
   */
  createToolbar(cell: CustomCodeCell) {
    const databaseSelect = new DatabaseSelect({
      cellModel: cell?.model,
      databasesPanel: this._databasesPanel
    });

    this._toolbar.addItem('select', databaseSelect);

    const variableName = new VariableName({ cell });
    this._toolbar.addItem('variable', variableName);
  }

  /**
   * Set the cell as SQL or not, and displaying the toolbar header.
   *
   * @param status - boolean, whether the cell is SQL or not.
   */
  setCellSql(status: boolean) {
    if (status) {
      this.addClass(HEADER_CLASS);
      (this.layout as SingletonLayout).widget = this._toolbar;
    } else {
      this.removeClass(HEADER_CLASS);
      (this.layout as SingletonLayout).removeWidget(this._toolbar);
    }
  }

  /**
   * Triggered before the widget is detached.
   */
  protected onBeforeDetach(msg: Message): void {
    (this.layout as SingletonLayout).removeWidget(this._toolbar);
  }

  private _databasesPanel: IDatabasesPanel;
  private _toolbar: ReactiveToolbar;
}
