/* eslint-disable no-console */
// This is a debug test file for local development troubleshooting
import { test, expect, type Page } from '@playwright/test';

async function gotoProjects(page: Page) {
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });

  // Wait for list load
  await page.waitForResponse(
    r => r.url().includes('/api/projects') && r.status() === 200,
    { timeout: 30000 }
  );
}

async function openCreateModal(page: Page) {
  const openButton = page.getByRole('button', { name: /create project|new project|create/i }).first();
  await expect(openButton).toBeVisible({ timeout: 30000 });
  await openButton.click();

  // Wait for modal to open
  const modal = page.locator('div.fixed.inset-0.z-50').first();
  await expect(modal).toBeVisible({ timeout: 30000 });
  return modal;
}

test('debug modal structure', async ({ page }) => {
  await gotoProjects(page);
  const modal = await openCreateModal(page);

  // Take screenshot of modal
  await modal.screenshot({ path: 'modal-debug.png' });

  // Log modal HTML
  const modalHTML = await modal.innerHTML();
  console.log('Modal HTML:', modalHTML);

  // Check what inputs are in the modal
  const inputs = await modal.locator('input').all();
  console.log(`Found ${inputs.length} input fields`);

  for (const input of inputs) {
    const name = await input.getAttribute('name');
    const placeholder = await input.getAttribute('placeholder');
    const type = await input.getAttribute('type');
    const label = await input.getAttribute('aria-label');
    console.log(`Input: name="${name}", placeholder="${placeholder}", type="${type}", aria-label="${label}"`);
  }

  // Check what buttons are in the modal
  const buttons = await modal.locator('button').all();
  console.log(`Found ${buttons.length} buttons`);

  for (const button of buttons) {
    const text = await button.textContent();
    const type = await button.getAttribute('type');
    console.log(`Button: text="${text?.trim()}", type="${type}"`);
  }

  // Try to fill the name field
  const nameInput = modal.locator('input[name="name"]').or(modal.locator('input').first());
  await nameInput.fill('Debug Test Project');

  // Try to find and click submit button
  const submitButton = modal.locator('button[type="submit"]').first();
  const hasSubmit = await submitButton.count() > 0;

  if (hasSubmit) {
    console.log('Found submit button, attempting click...');

    // Set up response listener BEFORE clicking
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/projects') && r.request().method() === 'POST',
      { timeout: 5000 }
    ).catch(e => {
      console.log('No POST request intercepted:', e.message);
      return null;
    });

    await submitButton.click();

    const response = await responsePromise;
    if (response) {
      console.log('POST response:', response.status(), await response.text());
    }
  } else {
    console.log('No submit button found with type="submit"');

    // Try alternative selectors
    const altButton = modal.getByRole('button', { name: /create|save/i }).first();
    if (await altButton.count() > 0) {
      console.log('Found alternative button, clicking...');
      await altButton.click();
    }
  }

  // Wait a bit to see what happens
  await page.waitForTimeout(2000);
});