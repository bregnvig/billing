import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { createDevice, revokeDevice } from './devices';
export { reportEvent } from './report-event';
