import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

// Smoke tests: Fast, deterministic, critical path verification
// Target: < 60s total runtime

test.describe('Smoke Tests - Critical Path', () => {
  test.setTimeout(30000); // 30s timeout per test

  test('should load homepage and navigate to projects', async ({ page }) => {
    // Load homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Verify we're redirected to projects or landing page
    await expect(page).toHaveURL(/\/(projects|$)/, { timeout: 10000 });

    // If not on projects, navigate there
    if (!page.url().includes('/projects')) {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
    }

    // Verify projects page loaded
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    // Verify key UI elements are present
    const createButton = page.getByRole('button', { name: /create|new/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
  });

  test('should create project and generate angles', async ({ page }) => {
    // Navigate to projects
    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });

    // Wait for projects list API
    await page.waitForResponse(
      r => r.url().includes('/api/projects') && r.status() === 200,
      { timeout: 10000 }
    );

    // Open create modal
    const createButton = page.getByRole('button', { name: /create|new/i }).first();
    await createButton.click();

    // Fill minimal required fields
    const projectName = `Smoke Test ${Date.now()}`;
    await page.locator('input[name="name"]').fill(projectName);
    await page.locator('input[name="product_name"]').fill('Test Product');
    await page.locator('textarea[name="product_description"]').fill('Quick smoke test');
    await page.locator('input[name="target_audience"]').fill('Test audience');
    await page.locator('textarea[name="key_benefits"]').fill('Fast\nReliable');
    await page.locator('textarea[name="pain_points"]').fill('Slow\nBroken');

    // Select tone if required
    const toneSelect = page.locator('select[name="tone"]');
    if (await toneSelect.count()) {
      await toneSelect.selectOption({ index: 0 });
    }

    // Submit form
    const submitButton = page.getByRole('button', { name: /create|save/i }).last();

    // Wait for project creation
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/projects') &&
             r.request().method() === 'POST' &&
             r.status() >= 200 && r.status() < 300,
        { timeout: 10000 }
      ),
      submitButton.click()
    ]);

    // Extract project ID
    const createJson = await createResponse.json().catch(() => null);
    const projectId = createJson?.data?.id || createJson?.id || createJson?.projectId;

    if (projectId) {
      // Navigate directly to angles page
      await page.goto(`${BASE_URL}/projects/${projectId}/angles`, { waitUntil: 'domcontentloaded' });
    } else {
      // Click on the project in the list
      await page.getByText(projectName).first().click();
      await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 10000 });
    }

    // Wait for angles page to load
    await page.waitForResponse(
      r => r.url().includes('/api/angles') && r.status() === 200,
      { timeout: 10000 }
    );

    // Click generate angles button
    const generateButton = page.getByTestId('generate-angles').or(
      page.getByRole('button', { name: /generate/i })
    ).first();

    await expect(generateButton).toBeVisible({ timeout: 10000 });

    // Generate angles
    const [generateResponse] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/generate') &&
             r.request().method() === 'POST' &&
             r.status() >= 200 && r.status() < 300,
        { timeout: 15000 }
      ),
      generateButton.click()
    ]);

    // Verify angles were created
    const generateJson = await generateResponse.json().catch(() => null);
    expect(generateJson).toBeTruthy();

    // Wait for UI to refresh with angles
    await page.waitForResponse(
      r => r.url().includes('/api/angles') &&
           r.request().method() === 'GET' &&
           r.status() === 200,
      { timeout: 10000 }
    );

    // Verify angle cards are rendered
    const angleCards = page.getByTestId('angle-card');
    await expect(angleCards.first()).toBeVisible({ timeout: 10000 });

    // Verify we have at least one angle card
    const angleCount = await angleCards.count();
    expect(angleCount).toBeGreaterThan(0);
  });

  test('should verify critical UI elements are accessible', async ({ page }) => {
    // Quick accessibility check for critical elements
    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });

    // Check for proper ARIA labels on key buttons
    const createButton = page.getByRole('button', { name: /create|new/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // Verify button has proper attributes
    const ariaLabel = await createButton.getAttribute('aria-label');
    if (!ariaLabel) {
      // Button should have readable text content at minimum
      const textContent = await createButton.textContent();
      expect(textContent).toBeTruthy();
    }

    // Check page has proper heading structure
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });
});