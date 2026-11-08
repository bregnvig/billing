import { TestBed } from '@angular/core/testing';
import { FIREBASE_APP } from '../firebase/firebase.providers';
import { ConsentService } from './consent.service';

const setup = () => {
  TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_APP, useValue: {} }] });
  return TestBed.inject(ConsentService);
};

describe('ConsentService', () => {
  beforeEach(() => localStorage.clear());

  it('asks (null) until a choice is made, then remembers it per device', () => {
    const consent = setup();
    expect(consent.choice()).toBeNull();
    consent.set('denied');
    expect(consent.choice()).toBe('denied');
    expect(JSON.parse(localStorage.getItem('loopme.consent')!)).toMatchObject({ analytics: 'denied', version: 1 });
  });

  it('asks again when the stored consent is from an older version', () => {
    localStorage.setItem('loopme.consent', JSON.stringify({ analytics: 'granted', version: 0, at: '2026-01-01' }));
    expect(setup().choice()).toBeNull();
  });

  it('deletes Google Analytics cookies when consent is declined, and keeps others', async () => {
    document.cookie = '_ga=GA1.1.123; path=/';
    document.cookie = '_ga_1CGCFBY0ND=GS1.1.456; path=/';
    document.cookie = 'other=keep; path=/';
    const consent = setup();
    consent.set('denied');
    TestBed.tick();
    await Promise.resolve();
    expect(document.cookie).not.toContain('_ga');
    expect(document.cookie).toContain('other=keep');
  });
});
