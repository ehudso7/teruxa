import { test, expect } from '@playwright/test';

test.describe('Projects Flow', () => {
  test('should create a project and verify it appears in the list', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load - wait for navigation or main content
    await page.waitForSelector('nav, header, [data-testid="app-header"], text=Projects', { timeout: 30000 });

    // Check if we're on the projects page or need to navigate there
    const projectsLink = page.locator('text=Projects').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
    }

    // Click on "Create Project" button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Project"), button:has-text("Add Project")').first();
    await createButton.click();

    // Fill in project details
    const projectName = `Test Project ${Date.now()}`;
    const projectDescription = 'This is an automated test project';

    // Fill in the project name
    await page.fill('input[name="name"], input[placeholder*="name" i], input[placeholder*="title" i]', projectName);

    // Fill in the description if available
    const descriptionField = page.locator('textarea[name="description"], textarea[placeholder*="description" i], input[name="description"]').first();
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(projectDescription);
    }

    // Fill in seed data (required for angle generation)
    const seedDataField = page.locator('textarea[name="seedData"], textarea[placeholder*="seed" i], textarea[placeholder*="product" i]').first();
    if (await seedDataField.isVisible()) {
      const sampleSeedData = JSON.stringify({
        productName: 'Test Product',
        targetAudience: 'Young professionals',
        uniqueSellingPoints: ['Feature 1', 'Feature 2'],
        painPoints: ['Problem 1', 'Problem 2']
      }, null, 2);
      await seedDataField.fill(sampleSeedData);
    }

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await submitButton.click();

    // Wait for navigation or success message
    await page.waitForLoadState('networkidle');

    // Verify the project appears in the list
    await expect(page.locator(`text="${projectName}"`)).toBeVisible({ timeout: 10000 });

    // Verify we can click on the project to view details
    await page.locator(`text="${projectName}"`).click();

    // Verify we're on the project details page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);

    // Verify project name is displayed
    await expect(page.locator('h1, h2').filter({ hasText: projectName })).toBeVisible();
  });

  test('should list existing projects', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load - wait for navigation or main content
    await page.waitForSelector('nav, header, [data-testid="app-header"], text=Projects', { timeout: 30000 });

    // Navigate to projects if needed
    const projectsLink = page.locator('text=Projects').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
    }

    // Wait for projects list to load
    await page.waitForLoadState('networkidle');

    // Check that the projects container exists
    const projectsList = page.locator('[data-testid="projects-list"], .projects-list, main').first();
    await expect(projectsList).toBeVisible();

    // Verify that either projects are shown or "no projects" message is displayed
    const hasProjects = await page.locator('[data-testid="project-item"], .project-item, article').count() > 0;
    const hasEmptyMessage = await page.locator('text=/no projects|empty|create your first/i').isVisible();

    expect(hasProjects || hasEmptyMessage).toBeTruthy();
  });
});