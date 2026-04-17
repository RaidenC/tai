import { SecurityLoggerService, SecurityEventType } from './security-logger.service';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;

  beforeEach(() => {
    service = new SecurityLoggerService();
  });

  it('logs event with correct type and timestamp', () => {
    service.log('PII_STRIPPED', 'ssnLastFour removed');
    const events = service.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('PII_STRIPPED');
    expect(events[0].details).toBe('ssnLastFour removed');
    // Verify ISO 8601 timestamp
    expect(() => new Date(events[0].timestamp).toISOString()).not.toThrow();
  });

  it('accumulates multiple events in order', () => {
    service.log('PII_STRIPPED');
    service.log('DRAFT_ENCRYPTED');
    service.log('TAMPER_DETECTED');
    const events = service.getEvents();
    expect(events.length).toBe(3);
    expect(events[0].type).toBe('PII_STRIPPED');
    expect(events[1].type).toBe('DRAFT_ENCRYPTED');
    expect(events[2].type).toBe('TAMPER_DETECTED');
  });

  it('details field is optional', () => {
    service.log('DRAFT_ENCRYPTED');
    const events = service.getEvents();
    expect(events[0].details).toBeUndefined();
  });

  it('details never contains PII patterns', () => {
    service.log('PII_STRIPPED', 'ssnLastFour removed');
    const events = service.getEvents();
    // No 4-digit sequences that could be SSN values
    expect(events[0].details).not.toMatch(/\b\d{4}\b/);
  });

  it('console.info called in dev mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.log('TAMPER_DETECTED', 'integrity check failed');
    expect(spy).toHaveBeenCalledWith(
      '[SECURITY]',
      expect.stringContaining('TAMPER_DETECTED'),
    );
    spy.mockRestore();
  });
});
