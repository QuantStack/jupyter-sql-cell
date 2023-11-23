import { CellChange, ISharedCodeCell } from '@jupyter/ydoc';
import { Cell, CodeCell, ICellHeader, ICodeCellModel } from '@jupyterlab/cells';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { ReactWidget, ReactiveToolbar } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { SingletonLayout, Widget } from '@lumino/widgets';

import { MAGIC } from './common';
import { IDatabasesPanel } from './sidepanel';
import { DatabaseSelect } from './widgets';
import { IKernelInjection } from './kernelInjection';

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
    const cell = new CodeCell({
      ...options,
      contentFactory: cellContentFactory
    }).initializeState();
    return cell;
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
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
  set cellModel(model: ICodeCellModel | null) {
    this._cellModel = model;
    this._cellModel?.sharedModel.changed.connect(
      this._onSharedModelChanged,
      this
    );

    const databaseSelect = ReactWidget.create(
      DatabaseSelect({
        cellModel: this._cellModel,
        databasesPanel: this._databasesPanel
      })
    );
    this._toolbar.addItem('select', databaseSelect);

    this._checkSource();
  }

  /**
   * Set the cell as SQL or not, and displaying the toolbar header.
   *
   * @param status - boolean, whether the cell is SQL or not.
   */
  private _setCellSql(status: boolean) {
    if (status) {
      this._isSQL = true;
      this.addClass(HEADER_CLASS);
      (this.layout as SingletonLayout).widget = this._toolbar;
    } else {
      this._isSQL = false;
      this.removeClass(HEADER_CLASS);
      (this.layout as SingletonLayout).removeWidget(this._toolbar);
    }
  }

  /**
   * Check the source of the cell for the MAGIC command, and attach or detach
   * the toolbar if necessary.
   */
  private _checkSource() {
    if (!this._kernelInjection.status) {
      this._setCellSql(false);
    }
    const sourceStart = this._cellModel?.sharedModel.source.substring(0, 5);
    if (sourceStart === MAGIC && !this._isSQL) {
      this._setCellSql(true);
    } else if (sourceStart !== MAGIC && this._isSQL) {
      this._setCellSql(false);
    }
  }

  /**
   * Triggered when the shared model change.
   */
  private _onSharedModelChanged = (_: ISharedCodeCell, change: CellChange) => {
    if (this._kernelInjection.status && change.sourceChange) {
      this._checkSource();
    }
  };

  /**
   * Triggered when the widget has been attached.
   */
  protected onAfterAttach(msg: Message): void {
    this.cellModel = (this.parent as CodeCell).model;
  }

  /**
   * Triggered before the widget is detached.
   */
  protected onBeforeDetach(msg: Message): void {
    (this.layout as SingletonLayout).removeWidget(this._toolbar);

    this._kernelInjection.statusChanged.disconnect((_, status) => {
      this._checkSource();
    }, this);

    this._cellModel?.sharedModel.changed.disconnect(
      this._onSharedModelChanged,
      this
    );
  }

  private _databasesPanel: IDatabasesPanel;
  private _kernelInjection: IKernelInjection;
  private _cellModel: ICodeCellModel | null = null;
  private _isSQL = false;
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
