import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    currentUser: null,
    role: 'employee',
    isPreboarding: false,
    simulationDate: '2026-06-25',
    setRole: vi.fn(),
    setSimulationDate: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'meridian-light', setTheme: vi.fn() }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('LoginPage sign-in', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
  });

  // Regression test for the P0.1 bug: login() was previously called with
  // only the email, and the backend accepted a hardcoded password server-side,
  // so whatever the user typed in the password field was silently ignored.
  it('submits the exact password the user typed, not a hardcoded one', async () => {
    mockLogin.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('jane.doe@meridian.com', 'correct-horse-battery-staple');
    expect(mockLogin).not.toHaveBeenCalledWith('jane.doe@meridian.com', 'password123');
  });

  it('shows an error and does not navigate when login fails', async () => {
    mockLogin.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /authenticate/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('password field starts empty, not pre-filled', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/password/i)).toHaveValue('');
  });
});

describe('LoginPage sign-up', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('requires a password of at least 8 characters and never calls the API with a short one', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /don't have an account\? sign up/i }));

    await user.type(screen.getByLabelText(/^name$/i), 'New Hire');
    await user.type(screen.getByLabelText(/email address/i), 'new.hire@meridian.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short1');
    await user.type(screen.getByLabelText(/confirm password/i), 'short1');
    await user.type(screen.getByLabelText(/slack handle/i), '@new.hire');
    await user.type(screen.getByLabelText(/^role$/i), 'Software Specialist');
    await user.type(screen.getByLabelText(/hire date/i), '2026-08-01');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
