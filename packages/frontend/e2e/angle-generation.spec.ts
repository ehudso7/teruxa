import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickAngleText(angle: any): string | null {
  if (!angle || typeof angle !== 'object') return null;

  const candidates: Array<unknown> = [
    angle.title,
    angle.headline,
    angle.hook,
    angle.angle,
    angle.content,
    angle.description,
    angle.summary,
    angle.body,
    // common nested shapes
    angle.data?.title,
    angle.data?.headline,
    angle.data?.hook,
    angle.data?.content,
  ];

  for (const c of candidates) {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t.length >= 8) return t;
    }
  }
  return null;
}

function extractProjectId(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const direct = payload.id || payload.projectId;
  if (typeof direct === 'string' && direct.length > 10) return direct;

  const nested = payload.project?.id || payload.project?.projectId || payload.data?.id || payload.data?.projectId;
  if (typeof nested === 'string' && nested.length > 10) return nested;

  return null;
}

function extractAngles(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.angles && Array.isArray(payload.angles)) return payload.angles;
  if (payload?.data?.angles && Array.isArray(payload.data.angles)) return payload.data.angles;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function gotoProjects(page: Page) {
  await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });

  // Prefer an API-backed "ready" signal; allow 200 or 304 (cache)
  await page.waitForResponse(
    (r) =>
      r.url().includes('/api/projects') &&
      r.request().method() === 'GET' &&
      (r.status() === 200 || r.status() === 304),
    { timeout: 30000 }
  );
}

async function openCreateProjectModal(page: Page) {
  // Use semantic-ish fallback: any obvious create button
  const openBtn = page.locator(
    'button:has-text("Create Project"), button:has-text("New Project"), button:has-text("Create")'
  ).first();

  await expect(openBtn).toBeVisible({ timeout: 30000 });
  await openBtn.click();

  // Modal presence = required field appears
  await expect(page.locator('input[name="name"]').first()).toBeVisible({ timeout: 30000 });

  // Return a scoped form locator (safer than guessing modal container classes)
  const form = page.locator('form').filter({ has: page.locator('input[name="name"]') }).first();
  await expect(form).toBeVisible({ timeout: 30000 });
  return form;
}

async function createProject(page: Page) {
  await gotoProjects(page);

  const form = await openCreateProjectModal(page);

  const projectName = `Test Project ${Date.now()}`;

  // Fill REQUIRED fields (based on your modal HTML dump)
  await form.locator('input[name="name"]').fill(projectName);
  await form.locator('input[name="product_name"]').fill('Teruxa Test Product');
  await form.locator('textarea[name="product_description"]').fill('A test product description for deterministic E2E.');
  await form.locator('input[name="target_audience"]').fill('People who need reliable E2E tests.');
  await form.locator('textarea[name="key_benefits"]').fill('Fast\nAccurate\nReliable');
  await form.locator('textarea[name="pain_points"]').fill('Flaky tests\nUnclear selectors\nCI instability');

  // Tone select required
  const toneSelect = form.locator('select[name="tone"]');
  if (await toneSelect.count()) {
    await toneSelect.selectOption({ value: 'professional' });
  }

  // Prepare POST wait BEFORE submit
  const createRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/projects') &&
      r.request().method() === 'POST' &&
      r.status() >= 200 &&
      r.status() < 300,
    { timeout: 30000 }
  );

  // Submit (inside the form)
  await form.locator('button[type="submit"]').first().click();

  const createResp = await createRespPromise;
  const createJson = await createResp.json().catch(() => null);

  const projectId = extractProjectId(createJson);
  expect(projectId, `Could not extract projectId from create response: ${JSON.stringify(createJson)}`).toBeTruthy();

  // Modal closes = name input disappears
  await expect(page.locator('input[name="name"]').first()).toBeHidden({ timeout: 30000 });

  return { projectId: projectId as string, projectName };
}

async function generateAngles(page: Page, projectId: string) {
  // Go straight to angles page for this project
  await page.goto(`${BASE_URL}/projects/${projectId}/angles`, { waitUntil: 'domcontentloaded' });

  // Page fetches angles initially (allow empty)
  await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/angles/projects/${projectId}/angles`) &&
      r.request().method() === 'GET' &&
      (r.status() === 200 || r.status() === 304),
    { timeout: 30000 }
  );

  // Click generate (whatever the UI calls it)
  const generateBtn = page
    .getByRole('button', { name: /generate/i })
    .or(page.locator('button:has-text("Generate Angles"), button:has-text("Generate")'))
    .first();

  await expect(generateBtn).toBeVisible({ timeout: 30000 });

  const genRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/angles/projects/${projectId}/generate`) &&
      r.request().method() === 'POST' &&
      r.status() >= 200 &&
      r.status() < 400,
    { timeout: 30000 }
  );

  await generateBtn.click();
  await genRespPromise;

  // After generate, the UI should re-fetch angles
  const anglesResp = await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/angles/projects/${projectId}/angles`) &&
      r.request().method() === 'GET' &&
      (r.status() === 200 || r.status() === 304),
    { timeout: 30000 }
  );

  // Pull angles from API directly (most reliable truth)
  let anglesJson: any = null;
  try {
    anglesJson = await anglesResp.json();
  } catch {
    // If 304, json() can be empty; fetch directly
    const direct = await page.request.get(`${BASE_URL}/api/angles/projects/${projectId}/angles`);
    anglesJson = await direct.json().catch(() => null);
  }

  const angles = extractAngles(anglesJson);
  expect(angles.length, `Angles API returned empty payload: ${JSON.stringify(anglesJson)}`).toBeGreaterThan(0);

  // Assert UI renders at least ONE recognizable angle text
  const firstText = pickAngleText(angles[0]);
  if (firstText) {
    // Use a short snippet to avoid exact formatting differences
    const snippet = firstText.slice(0, Math.min(30, firstText.length));
    const re = new RegExp(escapeRegExp(snippet), 'i');
    await expect(page.getByText(re).first()).toBeVisible({ timeout: 30000 });
  } else {
    // Fallback: at least something on screen besides the Generate button
    await expect(page.locator('main').first()).toBeVisible({ timeout: 30000 });
  }

  return { angles, firstText };
}

async function testAngleCardInteractions(page: Page, projectId: string) {
  // Test deterministic angle card interactions
  // Wait for angle cards to be visible
  await expect(page.getByTestId('angle-card').first()).toBeVisible({ timeout: 30000 });

  // Test Mark Winner button
  const winnerButton = page.getByTestId('angle-mark-winner').first();
  await expect(winnerButton).toBeVisible({ timeout: 30000 });

  // Click winner button and wait for API response
  const winnerRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/angles') &&
      r.url().includes('/winner') &&
      r.request().method() === 'PATCH' &&
      r.status() >= 200 &&
      r.status() < 300,
    { timeout: 30000 }
  );

  await winnerButton.click();
  await winnerRespPromise;

  // Verify button text changed to indicate winner status
  await expect(winnerButton).toContainText('Winner', { timeout: 30000 });

  // Test Regenerate button
  const regenerateButton = page.getByTestId('angle-regenerate').first();
  await expect(regenerateButton).toBeVisible({ timeout: 30000 });

  // Click regenerate and wait for API response
  const regenRespPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/angles') &&
      r.url().includes('/regenerate') &&
      r.request().method() === 'POST' &&
      r.status() >= 200 &&
      r.status() < 300,
    { timeout: 30000 }
  );

  await regenerateButton.click();
  await regenRespPromise;

  // After regeneration, the UI should re-fetch angles
  await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/angles/projects/${projectId}/angles`) &&
      r.request().method() === 'GET' &&
      (r.status() === 200 || r.status() === 304),
    { timeout: 30000 }
  );
}

test.describe('Angle Generation Happy Path', () => {
  // Helps avoid cross-test interference while you're still stabilizing UI selectors
  test.describe.configure({ mode: 'serial' });

  test('should create project and generate angles using AI mock mode', async ({ page }) => {
    const { projectId } = await createProject(page);
    await generateAngles(page, projectId);

    // Test deterministic angle card interactions
    await testAngleCardInteractions(page, projectId);
  });

  test('should display and interact with generated angles', async ({ page }) => {
    const { projectId } = await createProject(page);
    await generateAngles(page, projectId);

    // Assert all angle card controls are accessible and functional
    await testAngleCardInteractions(page, projectId);
  });
});