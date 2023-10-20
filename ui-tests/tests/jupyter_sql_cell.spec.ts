import { IJupyterLabPageFixture, expect, galata, test } from '@jupyterlab/galata';
import { Locator } from '@playwright/test';
import * as path from 'path';

const fileName = 'simple.ipynb';

async function openSidePanel(
  page: IJupyterLabPageFixture
): Promise<Locator> {
  const tabBar = page.locator('.jp-SideBar.jp-mod-left');
  const button = tabBar?.locator('li[title="Databases"]');
  await button.click();
  const content = page.locator('#jp-left-stack .lm-StackedPanel-child:not(.lm-mod-hidden)');
  await expect(content).toHaveClass(/jp-sqlcell-databases-panel/);
  return content;
}

async function switchCellToSql(
  page: IJupyterLabPageFixture,
  index: number
): Promise<void> {
  await page.notebook.setCellType(index, 'raw');
  await (await page.notebook.getCellInput(index))?.click();
  await page
    .locator('.jp-cell-toolbar [data-command="jupyter-sql-cell:switch"]')
    .click();
}

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

    await switchCellToSql(page, 2);

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

test.describe('sidebar', () => {
  test('There should be a database button on side panel', async ({ page }) => {
    const tabBar = await page.sidebar.getTabBar('left');
    const button = await tabBar?.$('li[title="Databases"]');
    expect(button).not.toBeNull();
    expect(await button?.screenshot()).toMatchSnapshot('sidebar_icon.png');
  });

  test('Side panel should have two database', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    const titles = sidepanel.locator('.jp-AccordionPanel-title');
    expect(titles).toHaveCount(2);
  });

  test('Should display tables list', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    const titles = sidepanel.locator('.jp-AccordionPanel-title');
    await titles.first().click();
    expect(await titles.first().getAttribute('aria-expanded')).toBe('true');
    const tables = sidepanel.locator('.jp-sqlcell-table-title');
    expect(tables).toHaveCount(1);
    expect(await tables.first().textContent()).toBe('world');
  });

  test('Should display columns list', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    await sidepanel.locator('.jp-AccordionPanel-title').first().click();
    const table = sidepanel.locator('.jp-sqlcell-table-title');
    await table.click();
    await expect(table).toHaveAttribute('aria-expanded', 'true');
    const columns = sidepanel.locator('.jp-sqlcell-column-items li');
    expect(columns).toHaveCount(35);
    expect(columns.first()).toContainText('Abbreviation');
  });
});

test.describe('connect database to cell', () => {
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

  test('Connect button should be enable for SQL cell only', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    const button = sidepanel.locator(
      '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
    ).first();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    expect(await button?.screenshot()).toMatchSnapshot('connect_button_disabled.png');
    await(await page.notebook.getCell(1))?.click();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await(await page.notebook.getCell(2))?.click();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await switchCellToSql(page, 2);
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(await button?.screenshot()).toMatchSnapshot('connect_button_enabled.png');
  });

  test('Connect button should be pressed on click', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    const button = sidepanel.locator(
      '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
    ).first();

    await switchCellToSql(page, 2);
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await button?.screenshot()).toMatchSnapshot('connect_button_pressed.png');
  });

  test('Should connect a database to a cell', async ({ page, tmpPath }) => {
    const sidepanel = await openSidePanel(page);
    const button = sidepanel.locator(
      '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
    ).first();

    await page.notebook.setCell(2, 'raw', 'SELECT * FROM world');
    await switchCellToSql(page, 2);
    await button.click();

    const execute = page.locator(
      '.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]'
    );
    await execute.click();

    await page.sidebar.openTab('filebrowser');
    const files = page.locator('li.jp-DirListing-item');
    await page.filebrowser.openDirectory(`${tmpPath}/_sql_output`);

    await expect(files).toHaveCount(1);
    expect(files.first()).toHaveAttribute('data-file-type', 'csv');
  });

  test(
    'Should not create an output file with wrong query',
    async ({ page, tmpPath }) => {
      const sidepanel = await openSidePanel(page);
      const button = sidepanel.locator(
        '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
      ).first();

      await page.notebook.setCell(2, 'raw', 'SELECT * FROM albums');
      await switchCellToSql(page, 2);
      await button.click();

      const execute = page.locator(
        '.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]'
      );
      await execute.click();

      await page.sidebar.openTab('filebrowser');
      const opening = await page.filebrowser.openDirectory(`${tmpPath}/_sql_output`);
      expect(opening).toBeFalsy();
  });

  test(
    'Should connect several databases to several cells',
    async ({ page, tmpPath }) => {
      const sidepanel = await openSidePanel(page);
      const button1 = sidepanel.locator(
        '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
      ).first();
      const button2 = sidepanel.locator(
        '.jp-AccordionPanel-title .jp-sqlcell-database-selectbutton'
      ).last();

      await page.notebook.setCell(1, 'raw', 'SELECT * FROM world');
      await switchCellToSql(page, 1);
      await button1.click();

      await page.notebook.setCell(2, 'raw', 'SELECT * FROM albums');
      await switchCellToSql(page, 2);
      await button2.click();

      const execute = page.locator(
        '.jp-cell-toolbar [data-command="jupyter-sql-cell:execute"]'
      );
      await (await page.notebook.getCellInput(1))?.click();
      await execute.click();

      await page.sidebar.openTab('filebrowser');
      const files = page.locator('li.jp-DirListing-item');

      await page.filebrowser.openDirectory(`${tmpPath}/_sql_output`);
      await expect(files).toHaveCount(1);

      await page.filebrowser.openDirectory(tmpPath);

      await (await page.notebook.getCellInput(2))?.click();
      await execute.click();
      await page.filebrowser.openDirectory(`${tmpPath}/_sql_output`);
      await expect(files).toHaveCount(2);
  });
});
