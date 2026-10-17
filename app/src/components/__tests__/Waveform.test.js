import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Waveform from '../Waveform';

describe('Waveform', () => {
  it('is decorative (hidden from screen readers) without onSeek', () => {
    render(<Waveform seed="c1" bars={10} progress={0.5} testID="wave" />);
    expect(screen.queryByRole('adjustable')).toBeNull();
  });

  it('is an adjustable seek control that steps by screen-reader actions', () => {
    const onStep = jest.fn();
    render(
      <Waveform
        seed="c1"
        bars={10}
        progress={0.25}
        onSeek={jest.fn()}
        onStep={onStep}
        accessibilityValueText="0:30 of 2:00"
      />,
    );
    const slider = screen.getByRole('adjustable');
    expect(slider.props.accessibilityValue).toMatchObject({ now: 25, text: '0:30 of 2:00' });
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });
});
