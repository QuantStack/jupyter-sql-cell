import { CellModel, RawCell } from '@jupyterlab/cells';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';

import { SQL_MIMETYPE } from './common';
import { IMapChange } from '@jupyter/ydoc';

/**
 * The class of the custom raw cell.
 */
const SQL_CELL_CLASS = 'jp-SqlCell';

/**
 * The cell content factory.
 */
export class CustomContentFactory
  extends Notebook.ContentFactory
  implements NotebookPanel.IContentFactory
{
  /**
   * Create a new content area for the panel.
   */
  createNotebook(options: Notebook.IOptions): Notebook {
    return new Notebook(options);
  }

  /**
   * Create raw/SQL cell.
   */
  createRawCell(options: RawCell.IOptions): RawCell {
    return new RawSqlCell(options).initializeState();
  }
}

/**
 * The raw/SQL cell.
 */
export class RawSqlCell extends RawCell {
  /**
   * The constructor method.
   */
  constructor(options: RawCell.IOptions) {
    super(options);
    if (this.model.getMetadata('format') === SQL_MIMETYPE) {
      this._sqlCell();
    }
  }

  /**
   * Handle changes in the metadata.
   */
  protected onMetadataChanged(model: CellModel, args: IMapChange<any>): void {
    super.onMetadataChanged(model, args);
    if (args.key === 'format') {
      if (this.model.getMetadata('format') === SQL_MIMETYPE) {
        this._sqlCell();
      } else {
        this._rawCell();
      }
    }
  }

  /**
   * Switch to raw cell type.
   */
  private _rawCell() {
    this.removeClass(SQL_CELL_CLASS);
    const trans = this.translator.load('jupyterlab');
    this.node.setAttribute('aria-label', trans.__('Raw Cell Content'));
    this.model.mimeType = IEditorMimeTypeService.defaultMimeType;
  }

  /**
   * Switch to SQL cell type, using codemirror SQL mimetype.
   */
  private _sqlCell() {
    this.addClass(SQL_CELL_CLASS);
    const trans = this.translator.load('jupyterlab');
    this.node.setAttribute('aria-label', trans.__('SQL Cell Content'));
    this.model.mimeType = SQL_MIMETYPE;
  }
}
