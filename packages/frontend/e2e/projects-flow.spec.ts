import { test, expect, type APIResponse, type Locator, type Page } from '@playwright/test';

type ProjectLite = { id?: string; projectId?: string; name?: string };

function pathMatchesProjects(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return /\/(api\/)?projects\/?$/.test(p);
  } catch {
    return false;
  }
}

async function parseProjectsFromResponse(resp: APIResponse): Promise<ProjectLite[]> {
  const json = await resp.json().catch(() => null);
  if (!json) return [];

  // Common shapes: { projects: [...] }, { data: [...] }, { items: [...] }, or [...]
  const arr =
    (Array.isArray(json) && json) ||
    (Array.isArray((json as any).projects) && (json as any).projects) ||
    (Array.isArray((json as any).data) && (json as any).data) ||
    (Array.isArray((json as any).items) && (json as any).items) ||
    [];

  if (!Array.isArray(arr)) return [];
  return arr as ProjectLite[];
}

function extractProjectIdFromCreate(respJson: any): string | null {
  if (!respJson) return null;

  const direct =
    respJson.id ||
    respJson.projectId ||
    respJson?.data?.id ||
    respJson?.data?.projectId ||
    respJson?.project?.id ||
    respJson?.project?.projectId;

  return typeof direct === 'string' && direct.length > 0 ? direct : null;
}

async function gotoProjects(page: Page): Promise<{ listResp: APIResponse; projects: ProjectLite[] }> {
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });

  const listResp = await page.waitForResponse(
    (r) => r.request().method() === 'GET' && pathMatchesProjects(r.url()) && r.status() === 200,
    { timeout: 30000 }
  );

  const projects = await parseProjectsFromResponse(listResp);
  return { listResp, projects };
}

async function openCreateProjectModal(page: Page): Promise<Locator> {
  const openButton = page.getByRole('button', { name: /create project|new project|create/i }).first();
  await expect(openButton).toBeVisible({ timeout: 30000 });
  await openButton.click();

  // Matches your debug HTML structure (no z-50 wrapper here)
  const modal = page.locator('div.fixed.inset-0').first();
  await expect(modal).toBeVisible({ timeout: 30000 });
  return modal;
}

async function fillRequiredProjectFields(modal: Locator, projectName: string) {
  // These match the real modal DOM you printed (name=... attributes)
  await modal.locator('input[name="name"]').fill(projectName);
  await modal.locator('input[name="product_name"]').fill('Teruxa Test Product');
  await modal.locator('textarea[name="product_description"]').fill('A test product description for deterministic E2E.');
  await modal.locator('input[name="target_audience"]').fill('Creators and marketers');

  await modal
    .locator('textarea[name="key_benefits"]')
    .fill('Saves time\nEasy to use\nAffordable');

  await modal
    .locator('textarea[name="pain_points"]')
    .fill('Current solutions are slow\nToo expensive\nHard to learn');

  // Select tone
  await modal.locator('select[name="tone"]').selectOption('professional');

  // Platforms appear checked by default in your HTML; leave them alone.
}

async function createProjectViaUI(page: Page) {
  await gotoProjects(page);

  const modal = await openCreateProjectModal(page);
  const projectName = `Test Project ${Date.now()}`;

  await fillRequiredProjectFields(modal, projectName);

  // Capture the POST response (any status), then validate it ourselves.
  const createRespPromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && pathMatchesProjects(r.url()),
    { timeout: 30000 }
  );

  const submitButton = modal.getByRole('button', { name: /create project|create|save/i }).first();
  await expect(submitButton).toBeVisible({ timeout: 30000 });
  await submitButton.click();

  const createResp = await createRespPromise;

  if (createResp.status() < 200 || createResp.status() >= 300) {
    const body = await createResp.text().catch(() => '<unable to read body>');
    throw new Error(
      `E2E: Project create failed\nURL: ${createResp.url()}\nStatus: ${createResp.status()}\nBody: ${body.slice(0, 2000)}`
    );
  }

  const createJson = await createResp.json().catch(() => null);
  const projectId = extractProjectIdFromCreate(createJson);

  // Modal should close
  await expect(modal).toBeHidden({ timeout: 30000 });

  // Re-load projects to ensure UI refresh is done (no race with "list refresh")
  const { projects } = await gotoProjects(page);

  // If backend returned id, prefer verifying by id/name. Otherwise verify by name.
  const found = projects.find((p) => (projectId ? p.id === projectId || p.projectId === projectId : p.name === projectName));
  expect(found).toBeTruthy();

  // UI validation: the name should appear somewhere on the page (robust, no fragile selectors)
  await expect(page.getByText(projectName).first()).toBeVisible({ timeout: 30000 });

  return { projectName, projectId };
}

test.describe('Projects Flow', () => {
  test('should create a project and verify it appears in the list', async ({ page }) => {
    const { projectName, projectId } = await createProjectViaUI(page);

    // Navigate to details in the most deterministic way:
    // Prefer direct route if id exists, otherwise click by text.
    if (projectId) {
      await page.goto(`/projects/${projectId}`, { waitUntil: 'domcontentloaded' });

      // Confirm details API loads
      await page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          (() => {
            try {
              const p = new URL(r.url()).pathname.toLowerCase();
              return p.endsWith(`/projects/${projectId}`) || p.endsWith(`/api/projects/${projectId}`);
            } catch {
              return false;
            }
          })() &&
          r.status() === 200,
        { timeout: 30000 }
      );

      // Confirm we're not stuck on /projects list
      await expect(page).not.toHaveURL(/\/projects\/?$/i, { timeout: 30000 });
    } else {
      await page.getByText(projectName).first().click();
      await expect(page).not.toHaveURL(/\/projects\/?$/i, { timeout: 30000 });
    }
  });

  test('should list existing projects', async ({ page }) => {
    const { projects } = await gotoProjects(page);

    if (projects.length === 0) {
      // Empty state checks (robust)
      const emptyHeadingVisible = await page.getByRole('heading', { name: /no projects/i }).first().isVisible();
      const emptyCtaVisible = await page.getByText(/create your first project/i).first().isVisible();
      expect(emptyHeadingVisible || emptyCtaVisible).toBeTruthy();
      return;
    }

    // If API says projects exist, UI should show at least one project name.
    const firstName = projects.find((p) => typeof p.name === 'string' && p.name.length > 0)?.name;
    expect(firstName).toBeTruthy();
    if (firstName) {
      await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 30000 });
    }
  });
});