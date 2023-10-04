import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test('cell-toolbar should contains buttons for raw cells only', async ({
  page
}) => {
  await page.goto();
  await page.notebook.createNew();
  await page.notebook.addCell('code', '');

  // The cell toolbar should not contain SQL buttons for code cells
  await expect(page.locator('.jp-cell-toolbar')).toHaveCount(1);

  expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
  ).not.toBeVisible();
  expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
  ).not.toBeVisible();

  // The cell toolbar should not contain SQL buttons for markdown cells
  await page.notebook.setCellType(1, 'markdown');

  expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
  ).not.toBeVisible();
  expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
  ).not.toBeVisible();

  // The cell toolbar should not contain SQL buttons for raw cells
  await page.notebook.setCellType(1, 'raw');

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
  await page.goto();
  await page.notebook.createNew();
  await page.notebook.addCell('raw', '');

  expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
  ).toBeDisabled();

  await page
    .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
    .click();
  await expect(
    page.locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]')
  ).toBeEnabled();
});
