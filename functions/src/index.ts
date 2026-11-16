import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { createDevice, revokeDevice } from './devices';
export { padDayEnds } from './pad-day-ends';
export { reportEvent } from './report-event';
