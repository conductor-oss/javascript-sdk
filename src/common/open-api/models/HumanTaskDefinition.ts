/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { HumanTaskAssignment } from "./HumanTaskAssignment";
import type { HumanTaskTemplate } from "./HumanTaskTemplate";
import type { HumanTaskTrigger } from "./HumanTaskTrigger";
import type { UserFormTemplate } from "./UserFormTemplate";

export type HumanTaskDefinition = {
  assignmentCompletionStrategy?: "LEAVE_OPEN" | "TERMINATE";
  assignments?: Array<HumanTaskAssignment>;
  taskTriggers?: Array<HumanTaskTrigger>;
  userFormTemplate?: UserFormTemplate;
  fullTemplate?: HumanTaskTemplate;
};
