import { test, expect } from '@playwright/test';

test.describe('Angle Generation Happy Path', () => {
  test('should create project and generate angles using AI mock mode', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Navigate to projects if needed
    const projectsLink = page.locator('text=Projects').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
    }

    // Create a new project with seed data
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Project"), button:has-text("Add Project")').first();
    await createButton.click();

    const projectName = `Angle Test ${Date.now()}`;

    // Fill in project details
    await page.fill('input[name="name"], input[placeholder*="name" i], input[placeholder*="title" i]', projectName);

    // Fill in comprehensive seed data for angle generation
    const seedData = {
      productName: 'FitTracker Pro',
      targetAudience: 'Health-conscious millennials aged 25-35',
      uniqueSellingPoints: [
        'AI-powered workout recommendations',
        'Seamless integration with smartwatches',
        'Social challenges with friends'
      ],
      painPoints: [
        'Lack of motivation to exercise',
        'Difficulty tracking progress',
        'Boring workout routines'
      ],
      brandVoice: 'Energetic, motivational, and friendly',
      competitorProducts: ['Fitbit', 'MyFitnessPal'],
      desiredOutcome: 'Get users excited about starting their fitness journey'
    };

    const seedDataField = page.locator('textarea[name="seedData"], textarea[placeholder*="seed" i], textarea[placeholder*="product" i]').first();
    await seedDataField.fill(JSON.stringify(seedData, null, 2));

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await submitButton.click();

    // Wait for navigation to project details
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });

    // Find and click the "Generate Angles" button
    const generateAnglesButton = page.locator('button:has-text("Generate Angles"), button:has-text("Generate"), button:has-text("Create Angles")').first();
    await expect(generateAnglesButton).toBeVisible({ timeout: 10000 });
    await generateAnglesButton.click();

    // Wait for angle generation to complete (may show loading state)
    const loadingIndicator = page.locator('.loading, .spinner, [data-testid="loading"]').first();
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
    }

    // Verify that angles are rendered
    await page.waitForSelector('[data-testid="angle-card"], .angle-card, article.angle', { timeout: 30000 });

    // Verify at least one angle card is present
    const angleCards = page.locator('[data-testid="angle-card"], .angle-card, article.angle');
    await expect(angleCards).toHaveCount(3, { timeout: 10000 }); // Expecting 3 angles based on mock

    // Verify angle structure (hook, problem, solution, CTA)
    const firstAngle = angleCards.first();

    // Check for key angle components
    const angleContent = await firstAngle.textContent();
    expect(angleContent).toBeTruthy();

    // Verify angle has essential components (checking for labels or content)
    const hasHook = angleContent?.toLowerCase().includes('hook') || angleContent?.includes('attention');
    const hasProblem = angleContent?.toLowerCase().includes('problem') || angleContent?.includes('struggle');
    const hasSolution = angleContent?.toLowerCase().includes('solution') || angleContent?.includes('fittracker');
    const hasCTA = angleContent?.toLowerCase().includes('cta') || angleContent?.toLowerCase().includes('call to action') || angleContent?.includes('download');

    expect(hasHook || hasProblem || hasSolution || hasCTA).toBeTruthy();
  });

  test('should display and interact with generated angles', async ({ page }) => {
    // This test assumes at least one project with angles exists
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Navigate to projects
    const projectsLink = page.locator('text=Projects').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
    }

    // Wait for projects to load
    await page.waitForLoadState('networkidle');

    // Click on the first available project (if any)
    const projectItems = page.locator('[data-testid="project-item"], .project-item, article').first();

    if (await projectItems.isVisible()) {
      await projectItems.click();

      // Wait for project details to load
      await page.waitForLoadState('networkidle');

      // Check if angles exist
      const angleCards = page.locator('[data-testid="angle-card"], .angle-card, article.angle');
      const angleCount = await angleCards.count();

      if (angleCount > 0) {
        // Verify angle status badges if present
        const statusBadge = page.locator('[data-testid="angle-status"], .status, .badge').first();
        if (await statusBadge.isVisible()) {
          const statusText = await statusBadge.textContent();
          expect(['draft', 'in_review', 'approved', 'archived']).toContain(statusText?.toLowerCase());
        }

        // Test angle interaction - click on first angle
        const firstAngle = angleCards.first();
        await firstAngle.click();

        // Check if detail view or edit options appear
        const editButton = page.locator('button:has-text("Edit"), button:has-text("Update")').first();
        const localizeButton = page.locator('button:has-text("Localize"), button:has-text("Translate")').first();

        const hasInteraction = await editButton.isVisible() || await localizeButton.isVisible();
        expect(hasInteraction).toBeTruthy();
      }
    }
  });
});