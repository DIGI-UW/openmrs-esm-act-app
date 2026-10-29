import type React from 'react';
import { getGlobalStore } from '@openmrs/esm-framework';

// The form engine's `FormsStore`; whoever asks first creates it, so it starts with every list empty.
const formsEngineStore = 'forms-engine-store';

interface FormsEngineRegistry {
  controls: Array<{ name: string; type: string; load: () => Promise<{ default: React.ComponentType<any> }> }>;
  postSubmissionActions: Array<unknown>;
  expressionHelpers: Record<string, Function>;
  fieldValidators: Array<unknown>;
  fieldValueAdapters: Array<unknown>;
  dataSources: Array<unknown>;
  formSchemaTransformers: Array<unknown>;
}

const emptyRegistry: FormsEngineRegistry = {
  controls: [],
  postSubmissionActions: [],
  expressionHelpers: {},
  fieldValidators: [],
  fieldValueAdapters: [],
  dataSources: [],
  formSchemaTransformers: [],
};

/** Lets a form's calculate expression call the helper by its name. */
export function registerExpressionHelper(name: string, helper: Function) {
  getGlobalStore<FormsEngineRegistry>(formsEngineStore, emptyRegistry).getState().expressionHelpers[name] = helper;
}

/** Lets a form question render this component by its `rendering`; the engine loads it when the question first shows. */
export function registerControl(control: FormsEngineRegistry['controls'][number]) {
  getGlobalStore<FormsEngineRegistry>(formsEngineStore, emptyRegistry).getState().controls.push(control);
}
