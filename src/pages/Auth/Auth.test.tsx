// src/pages/Auth/Auth.test.tsx
import { render, screen } from '@testing-library/react';
import Auth from './Auth';
import { describe, it, expect } from 'vitest';

describe('Auth', () => {
  it('renders the login button', () => {
    render(<Auth />);
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });
});
