import { getAppStatus } from './appStatus';

describe('getAppStatus', () => {
  test('shows green only when an active call has both STT lanes', () => {
    expect(getAppStatus({ isActive: true, connectionState: 'connected', connectProgress: { socketEn: 'open', socketEs: 'open' } }).tone).toBe('live');
  });

  test('shows red for an STT error and never treats silence as an outage', () => {
    expect(getAppStatus({ isActive: true, connectionState: 'error' }).tone).toBe('error');
    expect(getAppStatus({ isActive: true, connectionState: 'connected' }).tone).toBe('warn');
  });
});
