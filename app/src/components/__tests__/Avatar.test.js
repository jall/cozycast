import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Avatar from '../Avatar';

// Avatar resolves a storage path to a public URL via the client; stub it so the
// component test stays offline and deterministic.
jest.mock('../../api/client', () => ({
  avatarUrl: (p) => (p ? `https://cdn/${p}` : null),
}));

describe('Avatar', () => {
  it('shows the name initial when there is no picture', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('falls back to “?” for an empty name', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders the image (no initial) when a path is provided', () => {
    render(<Avatar name="Alice" path="u1/a.png" />);
    expect(screen.queryByText('A')).toBeNull();
  });
});
