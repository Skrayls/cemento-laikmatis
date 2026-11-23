import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const originDate = new Date('2026-11-22T12:00:00.000Z');

async function freezeClock(page) {
  await page.clock.install({ time: originDate });
  await page.clock.pauseAt(new Date(originDate.getTime() + 1000));
}

async function startTimer(page) {
  await page.locator('#start').click();
  // Starting first claims the session lock asynchronously. Don't jump the
  // injected clock while the zero of the session is still being established.
  await expect(page.locator('body')).toHaveAttribute('data-running', 'true');
  await expect(page.getByRole('timer')).toHaveText('00:00');
}

test('literature reference starts at zero, shows fixed study temperature, and stays active past the final phase', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible();
  await expect(timer).toHaveText('00:00');
  await expect(page.locator('#phase')).toHaveText('Paruošta');
  await expect(page.locator('#countdown')).toBeHidden();
  await expect(page.locator('#timeline')).toBeVisible();
  await expect(page.locator('#reference-temp')).toHaveText('Atskaitos temperatūra · 20 °C');
  await expect(page.locator('#temp')).toBeHidden();
  expect((await timer.boundingBox()).y).toBeLessThan((await page.locator('#product').boundingBox()).y);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('#start')).toBeEnabled();

  await startTimer(page);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#product')).toBeHidden();
  await expect(page.locator('#phase')).toHaveText(/^maišymas$/i);
  await expect(page.locator('#session-config')).toHaveText(/20\s*°C/);
  await page.clock.runFor(1_100);
  await expect(timer).toHaveText('00:01');
  await expect(page.locator('#remaining')).toHaveText('00:29');

  // A long gap with advancing monotonic and system clocks models throttled callbacks.
  await page.clock.fastForward(30 * 60_000);
  await page.clock.runFor(100);
  await expect(timer).toHaveText('30:01');
  await expect(page.locator('#phase')).toHaveText(/sukietėjimo orientyras pasiektas/i);
  await expect(page.locator('#remaining')).not.toHaveText(/-/);
  await page.clock.runFor(1_100);
  await expect(timer).toHaveText('30:02');
});

test('all modeled phases advance at their exact boundary, without a negative countdown', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  const ends = await page.evaluate(async () => (await import('./products.mjs')).resolveConfig('pmma').boundaries);
  const phase = page.locator('body');
  const currentStep = page.locator('#timeline-labels [aria-current="step"]');
  let elapsed = 0;

  for (const [index, end] of ends.entries()) {
    for (const offset of [-1000, 0, 1000]) {
      const time = end + offset;
      await page.clock.fastForward(time - elapsed);
      elapsed = time;
      // Sample the exact fake time, as the app does when visibility changes.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      const expected = offset < 0 ? index : index + 1;
      await expect(phase).toHaveAttribute('data-phase', String(expected === ends.length ? 4 : expected));
      if (expected < ends.length) {
        await expect(currentStep).toHaveAttribute('data-step', String(expected));
        await expect(page.locator('#remaining')).toBeVisible();
        if (offset < 0) await expect(page.locator('#remaining')).toHaveText('00:01');
        else await expect(page.locator('#remaining')).toHaveText(/^\d{2}:\d{2}$/);
      } else {
        await expect(currentStep).toHaveCount(0);
        await expect(page.locator('#countdown')).toBeHidden();
      }
    }
  }
});

test('cancel preserves running elapsed; abandoning and starting a new session are explicit', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  const timer = page.getByRole('timer');
  const dialog = page.getByRole('dialog');

  await page.locator('#abandon').click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#confirm-no')).toBeFocused();
  await page.clock.runFor(2_100);
  await page.locator('#confirm-no').click();
  await expect(dialog).toBeHidden();
  await expect(timer).toHaveText('00:02');

  await page.locator('#abandon').click();
  await page.locator('#confirm-yes').click();
  await expect(page.locator('#new-session')).toBeVisible();
  await page.clock.runFor(2_100);
  await expect(timer).toHaveText('00:02');

  await page.locator('#new-session').click();
  if (await dialog.isVisible()) await page.locator('#confirm-yes').click();
  await expect(timer).toBeVisible();
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#start')).toBeEnabled();
});

test('Hi-Fatigue selectors update the approximate timeline', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await page.locator('#product').selectOption('hi-fatigue');
  await page.locator('#temp').selectOption('23');
  await page.locator('#method').selectOption('manual');
  await expect(page.locator('#timeline-labels small')).toHaveText(['≈ 00:30', '≈ 06:00', '≈ 10:00']);
  await startTimer(page);
  await expect(page.locator('#configuration')).toBeHidden();
  await expect(page.locator('#manual-next')).toHaveCount(0);
});

test('Refobacin applies the selected historical IFU row', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await page.locator('#product').selectOption('refobacin');
  await page.locator('#temp').selectOption('21');
  await page.locator('#method').selectOption('chilledVacuum');
  await expect(page.locator('#timeline-labels small')).toHaveText(['00:30', '04:00', '08:20', '13:45']);
  await startTimer(page);
  await page.clock.runFor(30_100);
  await expect(page.locator('#phase')).toHaveText('Paruošimas');
  await expect(page.locator('#remaining')).toHaveText('03:30');
});

test('wall-only clock change freezes the last trustworthy elapsed and suppresses estimates', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  await page.clock.runFor(2_100);
  await expect(page.getByRole('timer')).toHaveText('00:02');
  await page.clock.setSystemTime(new Date(originDate.getTime() - 25_000));
  await page.clock.runFor(1_100);
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#notice')).toHaveText(/laik/i);
  await expect(page.getByRole('timer')).toHaveText('00:02');
  await expect(page.locator('#next-phase')).toBeHidden();
  await page.clock.runFor(5_100);
  await expect(page.getByRole('timer')).toHaveText('00:02');
});

test('reload preserves the selected snapshot but shows an unverified elapsed gap', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  await page.clock.runFor(5_100);
  await expect(page.getByRole('timer')).toHaveText('00:05');

  await page.reload();
  await expect(page.locator('#notice')).toHaveText(/atkurt/i);
  await expect(page.locator('#session-config')).toHaveText(/20\s*°C/);
  await expect(page.getByRole('timer')).not.toHaveText('00:00');
  await expect(page.locator('#next-phase')).toBeHidden();
  await expect(page.locator('#start')).toBeHidden();
});

test('a second tab cannot silently replace the first running session', async ({ page, context }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('#start')).toBeHidden();
  // Even if it permits confirmed administrative actions after its own recovery,
  // opening the second tab must not reset or take over the original one.
  await page.clock.runFor(2_100);
  await expect(page.getByRole('timer')).toHaveText('00:02');
  await expect(second.locator('#notice')).toBeVisible();
});

test('pre-cached app reloads offline and can start a new timer while disconnected', async ({ page, context }) => {
  await freezeClock(page);
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state;
  })).toBe('activated');
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await startTimer(page);
  await page.clock.runFor(2_100);
  await expect(page.getByRole('timer')).toHaveText('00:02');
  await expect(page.locator('#phase')).toHaveText(/^maišymas$/i);
  await page.reload();
  await expect(page.locator('#notice')).toHaveText(/atkurt/i);
  await expect(page.getByRole('timer')).toHaveText('00:02');
  await expect(page.locator('#timeline')).toBeHidden();
});

test('OR mode has a distraction-free fallback when fullscreen is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: false });
  });
  await page.goto('/');
  await startTimer(page);
  await expect(page.locator('#abandon')).toBeVisible();
  await page.locator('#or-mode').click();
  await expect(page.locator('body')).toHaveClass(/or-mode/);
  await expect(page.locator('#abandon')).toBeHidden();
  await expect(page.locator('#timeline')).toBeVisible();
  await page.locator('#or-mode').click();
  await expect(page.locator('body')).not.toHaveClass(/or-mode/);
  await expect(page.locator('#abandon')).toBeVisible();
});

test('native fullscreen keeps timing visible and exits via the app or the browser', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  const toggle = page.locator('#or-mode');
  const isFullscreen = () => page.evaluate(() => document.fullscreenElement === document.documentElement);

  await toggle.click();
  await expect.poll(isFullscreen).toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#abandon')).toBeHidden();
  await expect(page.locator('#timeline')).toBeVisible();
  await page.clock.runFor(1_100);
  await expect(page.getByRole('timer')).toHaveText('00:01');

  await toggle.click();
  await expect.poll(isFullscreen).toBe(false);
  await expect(page.locator('#abandon')).toBeVisible();

  await toggle.click();
  await expect.poll(isFullscreen).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#abandon')).toBeVisible();
});

test('Chromium acquires and releases a real screen wake lock when permitted', async ({ page, context }) => {
  await context.grantPermissions(['screen-wake-lock']);
  await page.addInitScript(() => {
    const request = navigator.wakeLock.request.bind(navigator.wakeLock);
    navigator.wakeLock.request = async type => {
      const sentinel = await request(type);
      document.documentElement.dataset.wakeLock = sentinel.released ? 'released' : 'held';
      sentinel.addEventListener('release', () => {
        document.documentElement.dataset.wakeLock = 'released';
      }, { once: true });
      return sentinel;
    };
  });
  await page.goto('/');
  await startTimer(page);
  const wake = page.locator('#wake');
  await wake.click();
  await expect(page.locator('html')).toHaveAttribute('data-wake-lock', 'held');
  await expect(wake).toHaveAttribute('aria-pressed', 'true');
  await wake.click();
  await expect(page.locator('html')).toHaveAttribute('data-wake-lock', 'released');
  await expect(wake).toHaveAttribute('aria-pressed', 'false');
});

test('screen wake failure is reported without interrupting elapsed time', async ({ page }) => {
  await freezeClock(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: async () => { throw new DOMException('Denied for test', 'NotAllowedError'); } },
    });
  });
  await page.goto('/');
  await startTimer(page);
  await page.locator('#wake').click();
  await expect(page.locator('#notice')).toHaveText(/negali palaikyti ekrano budrumo/i);
  await expect(page.locator('#wake')).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(1_100);
  await expect(page.getByRole('timer')).toHaveText('00:01');
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    const mobile = Math.min(viewport.width, viewport.height) <= 430;
    test.use({ viewport, reducedMotion: 'reduce', hasTouch: mobile, isMobile: mobile });

    test('timing view fits, keeps the timer dominant, and retains phase and timeline', async ({ page }, testInfo) => {
      await freezeClock(page);
      await page.goto('/');
      await startTimer(page);
      const ends = await page.evaluate(async () => (await import('./products.mjs')).resolveConfig('pmma').boundaries);
      const workingSample = ends[1] + 5_000;
      await page.clock.fastForward(workingSample);
      await page.clock.runFor(100);
      await expect(page.getByRole('timer')).not.toHaveText('00:00');
      await expect(page.locator('#phase')).toHaveText(/plastiška konsistencija/i);
      await expect(page.locator('#phase')).toBeInViewport();
      await expect(page.locator('#timeline')).toBeInViewport({ ratio: 0.9 });
      const geometry = await page.evaluate(() => {
        const timer = document.querySelector('#elapsed');
        const phase = document.querySelector('#phase');
        const size = (element) => Number.parseFloat(getComputedStyle(element).fontSize);
        return {
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
          verticalOverflow: document.documentElement.scrollHeight - innerHeight,
          clockSize: size(timer),
          phaseSize: size(phase),
        };
      });
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(geometry.verticalOverflow).toBeLessThanOrEqual(1);
      expect(geometry.clockSize).toBeGreaterThan(geometry.phaseSize * 2);
      if (viewport.width === 1920 || viewport.width === 390) {
        await testInfo.attach(`active-${viewport.width}x${viewport.height}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await page.locator('#or-mode').click();
        await expect(page.locator('body')).toHaveClass(/or-mode/);
        await expect(page.locator('#timeline')).toBeInViewport({ ratio: 0.9 });
        expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
        await testInfo.attach(`or-mode-${viewport.width}x${viewport.height}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await page.locator('#or-mode').click();
        await expect(page.locator('body')).not.toHaveClass(/or-mode/);
      }

      await page.clock.fastForward(ends.at(-1));
      await page.clock.runFor(100);
      await expect(page.locator('#phase')).toHaveText(/sukietėjimo orientyras pasiektas/i);
      await expect(page.locator('#timeline')).toBeInViewport({ ratio: 0.9 });
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    });
  });
}

test('the segmented timeline is proportional and advances with elapsed time', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  const ends = await page.evaluate(async () => (await import('./products.mjs')).resolveConfig('pmma').boundaries);
  await startTimer(page);
  const durations = ends.map((end, index) => end - (ends[index - 1] ?? 0));
  const segments = page.locator('.timeline-segment');
  await expect(segments).toHaveCount(3);
  const widths = await segments.evaluateAll(elements => {
    return elements.map(segment => segment.getBoundingClientRect().width);
  });
  expect(widths).toHaveLength(3);
  const width = widths.reduce((sum, part) => sum + part, 0);
  widths.forEach((part, index) => expect(part / width).toBeCloseTo(durations[index] / ends.at(-1), 2));
  const marker = page.locator('#timeline-marker');
  const zero = await marker.boundingBox();
  await page.clock.runFor(ends[1] + 250);
  await expect(page.locator('#phase')).toHaveText(/plastiška konsistencija/i);
  const atFirstBoundary = await marker.boundingBox();
  expect(atFirstBoundary.x).toBeGreaterThan(zero.x);
});

test('timer glyphs retain their width as the displayed digits change', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await startTimer(page);
  const timer = page.getByRole('timer');
  const digitsWidth = () => timer.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width;
  });
  const width = await digitsWidth();
  await page.clock.fastForward(71_100);
  await page.clock.runFor(100);
  await expect(timer).toHaveText('01:11');
  expect(await digitsWidth()).toBeCloseTo(width, 1);
});

test('automated accessibility: setup and active screen', async ({ page }) => {
  await page.goto('/');
  const audit = () => new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect((await audit()).violations).toEqual([]);
  await startTimer(page);
  expect((await audit()).violations).toEqual([]);
});

for (const [profile, methods, temperatures] of [
  ['refobacin', ['vacuum', 'manual', 'chilledVacuum'], [19, 21, 23]],
  ['hi-fatigue', ['vacuum', 'manual'], [18, 19, 20, 21, 22, 23]],
]) {
  for (const method of methods) for (const temp of temperatures) {
    test(`${profile}: ${method} at ${temp} °C reaches every boundary`, async ({ page }) => {
      await freezeClock(page);
      await page.goto('/');
      await page.locator('#product').selectOption(profile);
      await page.locator('#temp').selectOption(String(temp));
      await page.locator('#method').selectOption(method);
      const ends = await page.evaluate(async ([id, temp, method]) =>
        (await import('./products.mjs')).resolveConfig(id, temp, method).boundaries,
      [profile, temp, method]);
      await startTimer(page);
      let elapsed = 0;
      for (const [index, end] of ends.entries()) {
        await page.clock.fastForward(end - elapsed - 1000);
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await expect(page.locator('[aria-current="step"]')).toHaveAttribute('data-step', String(index));
        await expect(page.locator('#remaining')).toHaveText('00:01');
        await page.clock.fastForward(1000);
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        elapsed = end;
      }
      await expect(page.locator('#countdown')).toBeHidden();
      await expect(page.locator('#timeline-marker')).toHaveCSS('left', /px$/);
      await expect(page.locator('#phase')).toHaveText('Sukietėjimo orientyras pasiektas');
      const finalTime = await page.locator('#elapsed').textContent();
      await page.clock.runFor(1100);
      await expect(page.locator('#elapsed')).not.toHaveText(finalTime);
      await page.locator('#abandon').click();
      await page.locator('#confirm-yes').click();
      await page.locator('#new-session').click();
      await startTimer(page);
    });
  }
}
