import { IJupyterLabPageFixture, expect, test } from '@jupyterlab/galata';
import { Locator } from '@playwright/test';

async function openSidePanel(page: IJupyterLabPageFixture): Promise<Locator> {
  const tabBar = page.locator('.jp-SideBar.jp-mod-left');
  const button = tabBar?.locator('li[title="Databases"]');
  await button.click();
  const content = page.locator(
    '#jp-left-stack .lm-StackedPanel-child:not(.lm-mod-hidden)'
  );
  await expect(content).toHaveClass(/jp-sqlcell-databases-panel/);
  return content;
}

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
    const title = sidepanel.locator(
      '.jp-AccordionPanel-title[aria-label="world Section"]'
    );
    await title.locator('.lm-AccordionPanel-titleLabel').click();
    expect(await title.getAttribute('aria-expanded')).toBe('true');
    const tables = sidepanel.locator('.jp-sqlcell-table-title');
    expect(tables).toHaveCount(1);
    expect(await tables.first().textContent()).toBe('world');
  });

  test('Should display columns list', async ({ page }) => {
    const sidepanel = await openSidePanel(page);
    await sidepanel
      .locator('.jp-AccordionPanel-title[aria-label="world Section"]')
      .locator('.lm-AccordionPanel-titleLabel')
      .click();
    const table = sidepanel.locator('.jp-sqlcell-table-title');
    await table.click();
    await expect(table).toHaveAttribute('aria-expanded', 'true');
    const columns = sidepanel.locator('.jp-sqlcell-column-items li');
    expect(columns).toHaveCount(35);
    expect(columns.first()).toContainText('Abbreviation');
  });
});
