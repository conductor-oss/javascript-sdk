/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { HumanTaskUser } from './HumanTaskUser';

export type HumanTaskSearch = {
  assignees?: Array<HumanTaskUser>;
  claimants?: Array<HumanTaskUser>;
  definitionNames?: Array<string>;
  taskOutputQuery?: string;
  taskInputQuery?: string;
  searchType?: 'ADMIN' | 'INBOX';
  size?: number;
  start?: number;
  states?: Array<'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'TIMED_OUT' | 'DELETED'>;
  taskRefNames?: Array<string>;
  workflowIds?: Array<string>;
  workflowNames?: Array<string>;
};

