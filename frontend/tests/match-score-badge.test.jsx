import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchScoreBadge from '../src/features/scoring/components/MatchScoreBadge';

describe('MatchScoreBadge component', () => {
  describe('State 1: NOT_ANALYZED and unknown status', () => {
    it('renders "Chưa phân tích" when status is NOT_ANALYZED', () => {
      render(<MatchScoreBadge status="NOT_ANALYZED" fresh={true} totalScore={80} />);
      expect(screen.getByText('Chưa phân tích')).toBeTruthy();
      expect(screen.queryByText(/80/)).toBeNull();
    });

    it('renders "Chưa phân tích" when status is undefined or unknown', () => {
      render(<MatchScoreBadge status={undefined} />);
      expect(screen.getByText('Chưa phân tích')).toBeTruthy();

      const { container } = render(<MatchScoreBadge status="SOME_UNKNOWN_STATUS" />);
      expect(container.textContent).toContain('Chưa phân tích');
    });
  });

  describe('State 2: Stale analysis (fresh === false)', () => {
    it('renders "Cần tính lại" and never displays stale score even if status is COMPLETE', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={false}
          totalScore={95}
          recommendation="HIGH"
        />
      );

      expect(screen.getByText('Cần tính lại')).toBeTruthy();
      expect(screen.queryByText(/95/)).toBeNull();
      expect(screen.queryByText('Phù hợp cao')).toBeNull();
    });

    it('renders "Cần tính lại" when status is INCOMPLETE and fresh is false', () => {
      render(<MatchScoreBadge status="INCOMPLETE" fresh={false} />);
      expect(screen.getByText('Cần tính lại')).toBeTruthy();
    });
  });

  describe('State 3: INCOMPLETE and fresh', () => {
    it('renders "Thiếu dữ liệu" and never displays score', () => {
      render(
        <MatchScoreBadge
          status="INCOMPLETE"
          fresh={true}
          totalScore={65}
          recommendation="LOW"
        />
      );

      expect(screen.getByText('Thiếu dữ liệu')).toBeTruthy();
      expect(screen.queryByText(/65/)).toBeNull();
    });
  });

  describe('State 4: COMPLETE and fresh', () => {
    it('renders rounded score and Vietnamese HIGH recommendation', () => {
      const rawScore = 84.7;
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={rawScore}
          recommendation="HIGH"
        />
      );

      expect(screen.getByText('85%')).toBeTruthy();
      expect(screen.getByText('· Phù hợp cao')).toBeTruthy();
      // Ensure raw prop was not mutated
      expect(rawScore).toBe(84.7);
    });

    it('renders Vietnamese MEDIUM recommendation with rounded score', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={69.2}
          recommendation="MEDIUM"
        />
      );

      expect(screen.getByText('69%')).toBeTruthy();
      expect(screen.getByText('· Phù hợp')).toBeTruthy();
    });

    it('renders Vietnamese LOW recommendation with rounded score', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={42}
          recommendation="LOW"
        />
      );

      expect(screen.getByText('42%')).toBeTruthy();
      expect(screen.getByText('· Phù hợp thấp')).toBeTruthy();
    });

    it('does not coerce numeric string "82.4" to 82%', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore="82.4"
          recommendation="HIGH"
        />
      );

      expect(screen.queryByText(/82/)).toBeNull();
      expect(screen.queryByText(/%/)).toBeNull();
      expect(screen.getByText('Phù hợp cao')).toBeTruthy();
    });

    it.each([
      ['boolean true', true],
      ['boolean false', false],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
      ['null', null],
      ['undefined', undefined],
    ])('does not create synthetic scores or render NaN for %s', (_, invalidScore) => {
      const { container } = render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={invalidScore}
          recommendation="HIGH"
        />
      );

      expect(screen.queryByText(/NaN/i)).toBeNull();
      expect(screen.queryByText(/undefined/i)).toBeNull();
      expect(screen.queryByText(/Infinity/i)).toBeNull();
      expect(screen.queryByText(/%/)).toBeNull();
      expect(container.textContent).toContain('Phù hợp cao');
    });

    it('does not display raw unknown recommendation enums to users', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={85}
          recommendation="UNKNOWN_TIER_SPECIAL"
        />
      );

      expect(screen.getByText('85%')).toBeTruthy();
      expect(screen.queryByText(/UNKNOWN_TIER_SPECIAL/i)).toBeNull();
    });

    it('falls back to "Chưa có điểm" when score is malformed and recommendation is absent', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore="not-a-number"
        />
      );

      expect(screen.queryByText(/NaN/i)).toBeNull();
      expect(screen.getByText('Chưa có điểm')).toBeTruthy();
    });
  });

  describe('Accessibility & Keyboard Interaction', () => {
    it('renders a button with accessible name when onOpen is provided', async () => {
      const user = userEvent.setup();
      const handleOpen = vi.fn();
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={88}
          recommendation="HIGH"
          onOpen={handleOpen}
        />
      );

      const button = screen.getByRole('button', {
        name: /Điểm phù hợp: 88%, Phù hợp cao. Nhấn để xem chi tiết phân tích./i,
      });
      expect(button).toBeTruthy();
      expect(button.getAttribute('type')).toBe('button');

      await user.click(button);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('supports realistic keyboard navigation via Tab and Enter keys', async () => {
      const user = userEvent.setup();
      const handleOpen = vi.fn();
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={88}
          recommendation="HIGH"
          onOpen={handleOpen}
        />
      );

      const button = screen.getByRole('button', {
        name: /Điểm phù hợp: 88%, Phù hợp cao. Nhấn để xem chi tiết phân tích./i,
      });

      await user.tab();
      expect(document.activeElement).toBe(button);

      await user.keyboard('{Enter}');
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('supports realistic keyboard navigation via Tab and Space keys', async () => {
      const user = userEvent.setup();
      const handleOpen = vi.fn();
      render(
        <MatchScoreBadge
          status="INCOMPLETE"
          fresh={true}
          onOpen={handleOpen}
        />
      );

      const button = screen.getByRole('button', {
        name: /Phân tích hồ sơ: Thiếu dữ liệu. Nhấn để xem chi tiết phân tích./i,
      });

      await user.tab();
      expect(document.activeElement).toBe(button);

      await user.keyboard(' ');
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('renders a span without button semantics when onOpen is omitted', () => {
      render(
        <MatchScoreBadge
          status="COMPLETE"
          fresh={true}
          totalScore={75}
          recommendation="MEDIUM"
        />
      );

      expect(screen.queryByRole('button')).toBeNull();
      const badge = screen.getByLabelText(/Điểm phù hợp: 75%, Phù hợp/i);
      expect(badge.tagName).toBe('SPAN');
    });

    it('does not rely on color alone (includes text and icon for all states)', () => {
      const { container: c1 } = render(<MatchScoreBadge status="NOT_ANALYZED" />);
      expect(c1.querySelector('svg')).toBeTruthy();
      expect(c1.textContent).toContain('Chưa phân tích');

      const { container: c2 } = render(<MatchScoreBadge status="COMPLETE" fresh={false} />);
      expect(c2.querySelector('svg')).toBeTruthy();
      expect(c2.textContent).toContain('Cần tính lại');

      const { container: c3 } = render(<MatchScoreBadge status="INCOMPLETE" fresh={true} />);
      expect(c3.querySelector('svg')).toBeTruthy();
      expect(c3.textContent).toContain('Thiếu dữ liệu');

      const { container: c4 } = render(
        <MatchScoreBadge status="COMPLETE" fresh={true} totalScore={90} recommendation="HIGH" />
      );
      expect(c4.querySelector('svg')).toBeTruthy();
      expect(c4.textContent).toContain('90%');
      expect(c4.textContent).toContain('Phù hợp cao');
    });

    it('attaches id, aria-haspopup, and aria-controls to support drawer accessibility and focus restoration', () => {
      render(
        <MatchScoreBadge
          id="badge-test-trigger-id"
          status="COMPLETE"
          fresh={true}
          totalScore={85}
          recommendation="HIGH"
          onOpen={vi.fn()}
          aria-haspopup="dialog"
          aria-controls="score-drawer-dialog"
        />
      );

      const btn = screen.getByRole('button');
      expect(btn.id).toBe('badge-test-trigger-id');
      expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
      expect(btn.getAttribute('aria-controls')).toBe('score-drawer-dialog');

      const { container } = render(
        <MatchScoreBadge
          id="span-test-trigger-id"
          status="NOT_ANALYZED"
        />
      );
      const span = container.querySelector('#span-test-trigger-id');
      expect(span).toBeTruthy();
      expect(span.tagName).toBe('SPAN');
    });
  });
});
