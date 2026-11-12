import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function verifyInterviewFeedback({
  page, repo, applicationId, checks, button, login, transition, expectPost, evidenceDir, setTime,
}) {
  const dialog = page.getByRole('dialog');
  const section = dialog.getByRole('region', { name: 'Lịch phỏng vấn' });
  const formFor = round => section.getByRole('form', { name: `Đánh giá vòng ${round}` });
  const listButton = () => button('Xem CV và xử lý');
  const save = () => button('Lưu đánh giá');
  const offer = () => dialog.getByRole('button', { name: 'Gửi đề nghị', exact: true });
  const scheduledAt = Math.ceil((Date.now() + 60000) / 60000) * 60000;
  const localTime = new Date(scheduledAt + 7 * 3600000).toISOString().slice(0, 16);
  const proof = ['Ứng viên giải thích được xung đột revision.', 'Chưa đủ bằng chứng về xử lý đồng thời.'];
  const rounds = [];

  for (const round of [1, 2]) {
    await button('Lên lịch phỏng vấn').click();
    await page.getByText(`Lên lịch vòng ${round}`, { exact: true }).waitFor();
    await page.getByLabel(/Ngày giờ phỏng vấn/).fill(localTime);
    const { data: { interview } } = await expectPost(201);
    assert.equal(interview.round, round);
    rounds.push(interview._id);
    await button(`Ghi nhận đánh giá vòng ${round}`).waitFor();
  }
  const completeUrl = id => `/api/v1/interviews/${encodeURIComponent(id)}/feedback`;
  let writes = 0;
  page.on('request', request => {
    if (request.method() === 'PUT' && rounds.some(id => request.url().endsWith(completeUrl(id)))) writes++;
  });
  async function fill(round, rating, result) {
    await button(`Ghi nhận đánh giá vòng ${round}`).click();
    const form = formFor(round);
    await form.getByRole('radio', { name: `${rating} sao` }).check();
    await form.getByLabel('Bằng chứng đánh giá').fill(proof[round - 1]);
    await form.getByLabel('Kết quả phỏng vấn').selectOption(result);
    return form;
  }
  async function expectPut(round, status) {
    const pending = page.waitForResponse(response => response.request().method() === 'PUT' &&
      response.url().endsWith(completeUrl(rounds[round - 1])));
    await save().click();
    const received = await pending;
    assert.equal(received.status(), status);
    return received.json();
  }

  const first = await fill(1, 4, 'PASSED');
  await first.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: resolve(evidenceDir, 'desktop-feedback.png') });
  assert.equal((await expectPut(1, 422)).error.code, 'INVALID_INTERVIEW_TIMELINE');
  await first.getByRole('alert').waitFor();
  assert.equal(await first.getByLabel('Bằng chứng đánh giá').inputValue(), proof[0]);
  assert.equal((await repo.get(rounds[0])).completed_at, undefined);
  checks.push('API từ chối đánh giá trước giờ; giữ bản nháp và document chưa hoàn tất.');

  setTime(scheduledAt);
  const { data: passed } = await expectPut(1, 200);
  assert.equal(passed.score, 80);
  assert.equal(passed.result, 'PASSED');
  await section.getByText('Đạt · 80/100', { exact: true }).waitFor();
  assert.ok(await offer().isDisabled());
  const storedFirst = await repo.get(rounds[0]);
  assert.equal(storedFirst.feedback, proof[0]);
  assert.equal(storedFirst.completed_at, new Date(scheduledAt).toISOString());
  checks.push('Vòng 1 PASSED và 80/100 đã lưu; OFFER vẫn khóa khi vòng 2 chờ.');

  const second = await fill(2, 2, 'FAILED');
  const received = Promise.withResolvers();
  const release = Promise.withResolvers();
  await page.route(`**${completeUrl(rounds[1])}`, async route => {
    try {
      const response = await route.fetch({ timeout: 12000 });
      received.resolve({ status: response.status(), body: await response.json() });
      await release.promise;
    } catch (error) {
      received.reject(error);
    } finally {
      await route.abort('failed');
    }
  }, { times: 1 });
  await save().click();
  const committed = await received.promise;
  let beforeRetry;
  try {
    assert.equal(committed.status, 200);
    assert.equal(committed.body.data.result, 'FAILED');
    assert.ok(await button('Đang lưu đánh giá…').isDisabled());
    await second.dispatchEvent('submit');
    assert.equal(writes, 3);
    beforeRetry = await repo.get(rounds[1]);
    assert.equal(beforeRetry.feedback, proof[1]);
  } finally {
    release.resolve();
  }
  await second.getByRole('alert').waitFor();
  assert.equal(await second.getByLabel('Bằng chứng đánh giá').inputValue(), proof[1]);
  assert.equal((await expectPut(2, 200)).data.completed_at, beforeRetry.completed_at);
  const afterRetry = await repo.get(rounds[1]);
  assert.equal(afterRetry._rev, beforeRetry._rev);
  assert.equal(afterRetry.completed_at, beforeRetry.completed_at);
  assert.equal(writes, 4);
  await section.getByText('Không đạt · 40/100', { exact: true }).waitFor();
  checks.push('Vòng 2 FAILED và 40/100; chặn gửi trùng, retry giữ nguyên revision và thời điểm hoàn tất.');

  await page.reload();
  await login();
  await listButton().click();
  for (const text of ['Đạt · 80/100', 'Không đạt · 40/100', ...proof]) {
    await section.getByText(text, { exact: true }).waitFor();
  }
  assert.ok(await offer().isEnabled());
  await transition('Gửi đề nghị', offer());
  assert.equal((await repo.get(applicationId)).current_stage, 'OFFER');
  await button('Đóng hộp thoại').click();
  await listButton().click();
  await section.getByText(proof[0], { exact: true }).waitFor();
  await section.getByText(proof[1], { exact: true }).waitFor();
  assert.equal(await section.getByRole('button', { name: /Ghi nhận đánh giá/ }).count(), 0);
  assert.equal(await section.getByRole('button', { name: 'Lên lịch phỏng vấn' }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await section.evaluate(node => node.scrollIntoView({ block: 'center' }));
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
  await page.screenshot({ path: resolve(evidenceDir, 'mobile-feedback.png') });
  checks.push('Reload và chuyển OFFER thủ công thành công; đọc lại hai đánh giá ở chế độ chỉ xem trên mobile.');
}
