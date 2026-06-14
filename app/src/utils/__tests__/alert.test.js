/**
 * @jest-environment jsdom
 */
import { Alert, Platform } from 'react-native';
import { showAlert } from '../alert';

describe('showAlert', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('delegates to native Alert.alert when not on web', () => {
    Platform.OS = 'ios';
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const buttons = [{ text: 'OK' }];

    showAlert('Title', 'Message', buttons);

    expect(spy).toHaveBeenCalledWith('Title', 'Message', buttons);
  });

  it('shows a window.alert with title + message on web', () => {
    Platform.OS = 'web';
    window.alert = jest.fn();

    showAlert('Title', 'Message');

    expect(window.alert).toHaveBeenCalledWith('Title\n\nMessage');
  });

  it('still fires a single button onPress after the web alert', () => {
    Platform.OS = 'web';
    window.alert = jest.fn();
    const onPress = jest.fn();

    showAlert('T', 'M', [{ text: 'OK', onPress }]);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('runs the confirm action when the web confirm is accepted', () => {
    Platform.OS = 'web';
    window.confirm = jest.fn(() => true);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    showAlert('T', 'M', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Go', style: 'destructive', onPress: onConfirm },
    ]);

    expect(window.confirm).toHaveBeenCalledWith('T\n\nM');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs the cancel action when the web confirm is dismissed', () => {
    Platform.OS = 'web';
    window.confirm = jest.fn(() => false);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    showAlert('T', 'M', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Go', onPress: onConfirm },
    ]);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
