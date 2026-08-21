import { TYPERT_REMOTE } from './remote.js'

/** Host-face manifest discovered automatically by DSH's Typert loader. */
export const TYPERT = {
  package: 'dsh-usage',
  face: 'host',
  schemas: [],
  model: {
    services: [],
    events: [],
    objects: [],
  },
  invocations: TYPERT_REMOTE.descriptors,
} as const
