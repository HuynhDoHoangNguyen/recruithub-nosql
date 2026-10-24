import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../src/context/AuthContext';
import { useAuth } from '../../src/context/useAuth';
import api from '../../src/services/api';
import { getAccessToken, removeAccessToken } from '../../src/utils/authHelper';

vi.mock('../../src/services/api', () => ({ default: { get: vi.fn() } }));

function SessionControls() {
  const { user, login, logout, refreshMe } = useAuth();
  return <>
    <p>{user ? `signed in: ${user.role}` : 'signed out'}</p>
    <button onClick={() => login('test-token', { role: 'CANDIDATE' })}>Sign in</button>
    <button onClick={logout}>Sign out</button>
    <button onClick={() => refreshMe().catch(() => {})}>Verify session</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  removeAccessToken();
});

describe('AuthProvider session lifecycle', () => {
  it('clears memory token and user after server rejects an invalid or expired token', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    render(<AuthProvider><SessionControls /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(getAccessToken()).toBe('test-token');
    expect(screen.getByText('signed in: CANDIDATE')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Verify session' }));
    await waitFor(() => expect(screen.getByText('signed out')).toBeTruthy());
    expect(getAccessToken()).toBeNull();
  });

  it('clears memory token and user on logout', () => {
    render(<AuthProvider><SessionControls /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('signed out')).toBeTruthy();
    expect(getAccessToken()).toBeNull();
  });
});
