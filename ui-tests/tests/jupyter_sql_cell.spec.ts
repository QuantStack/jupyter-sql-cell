import { expect, galata, test } from '@jupyterlab/galata';
import * as path from 'path';

const fileName = 'simple.ipynb';

test.describe('cell toolbar', () => {
  test.beforeEach(async ({ page, request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.uploadFile(
      path.resolve(__dirname, `./notebooks/${fileName}`),
      `${tmpPath}/${fileName}`
    );
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);
  });

  test.afterEach(async ({ request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.deleteDirectory(tmpPath);
  });

  test('cell-toolbar should contain sql buttons for raw cells only', async ({
    page
  }) => {
    // SQL buttons shouldn't be visible in code cells.
    await (await page.notebook.getCellInput(0))?.click();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
    ).not.toBeVisible();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
    ).not.toBeVisible();

    // SQL buttons shouldn't be visible in markdown cells.
    await (await page.notebook.getCellInput(1))?.click();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
    ).not.toBeVisible();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
    ).not.toBeVisible();

    // SQL buttons should be visible in raw cells.
    await (await page.notebook.getCellInput(2))?.click();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
    ).toBeVisible();
    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
    ).toBeVisible();
  });

  test('cell-toolbar execute button should be enabled for sql cell only', async ({
    page
  }) => {
    await (await page.notebook.getCellInput(2))?.click();

    expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
    ).toBeDisabled();

    // Switching to sql cell should enable the run button.
    await page
      .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
      .click();

    await expect(
      page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
    ).toBeEnabled();
  });
});

test.describe('cell factory', () => {
  test.beforeEach(async ({ page, request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.uploadFile(
      path.resolve(__dirname, `./notebooks/${fileName}`),
      `${tmpPath}/${fileName}`
    );
    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);
  });

  test.afterEach(async ({ request, tmpPath }) => {
    const contents = galata.newContentsHelper(request);
    await contents.deleteDirectory(tmpPath);
  });

  test('SQL cells only should have jp-SqlCell class', async ({ page }) => {
    const cells = page.locator('.jp-Notebook .jp-Cell');

    await expect(cells).toHaveCount(3);

    await expect(cells.nth(0)).not.toHaveClass(/jp-SqlCell/);
    await expect(cells.nth(1)).not.toHaveClass(/jp-SqlCell/);
    await expect(cells.nth(2)).not.toHaveClass(/jp-SqlCell/);

    await (await page.notebook.getCellInput(2))?.click();
    await page
      .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
      .click();

    await expect(cells.nth(2)).toHaveClass(/jp-SqlCell/);
  });

  test('SQL cells should have SQL mimetype', async ({ page }) => {
    const cells = page.locator('.jp-Notebook .jp-Cell');

    // SQl cells should have SQL language.
    await (await page.notebook.getCellInput(2))?.click();
    await page
      .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
      .click();

    await expect(
      cells.nth(2).locator('div[contenteditable="true"]')
    ).toHaveAttribute('data-language', 'sql');

    // Raw cells not have codemirror language.
    await page
      .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
      .click();

    expect(
      await cells
        .nth(2)
        .locator('div[contenteditable="true"]')
        .getAttribute('data-language')
    ).toBe(null);
  });
});
