import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../ToastContext';

// Icons pull in expo-font, which isn't initialised under the unit-test renderer;
// stub them out so we can assert on the toast's text/logic.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function Trigger({ msg, kind = 'success' }) {
  const toast = useToast();
  return (
    <TouchableOpacity onPress={() => toast[kind](msg)}>
      <Text>trigger</Text>
    </TouchableOpacity>
  );
}

describe('ToastContext', () => {
  it('shows a toast message only after it is triggered', () => {
    render(
      <ToastProvider>
        <Trigger msg="Sent to one person" />
      </ToastProvider>,
    );

    expect(screen.queryByText('Sent to one person')).toBeNull();
    fireEvent.press(screen.getByText('trigger'));
    expect(screen.getByText('Sent to one person')).toBeTruthy();
  });

  it('throws when useToast is used outside a provider', () => {
    function Orphan() {
      useToast();
      return null;
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
