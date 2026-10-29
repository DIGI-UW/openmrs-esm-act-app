import { getGlobalStore } from '@openmrs/esm-framework';

// The form engine's `FormsStore`; whoever asks first creates it, so it starts with every list empty.
const formsEngineStore = 'forms-engine-store';

interface FormsEngineRegistry {
  controls: Array<unknown>;
  postSubmissionActions: Array<unknown>;
  expressionHelpers: Record<string, Function>;
  fieldValidators: Array<unknown>;
  fieldValueAdapters: Array<unknown>;
  dataSources: Array<unknown>;
  formSchemaTransformers: Array<unknown>;
}

/** Lets a form's calculate expression call the helper by its name. */
export function registerExpressionHelper(name: string, helper: Function) {
  getGlobalStore<FormsEngineRegistry>(formsEngineStore, {
    controls: [],
    postSubmissionActions: [],
    expressionHelpers: {},
    fieldValidators: [],
    fieldValueAdapters: [],
    dataSources: [],
    formSchemaTransformers: [],
  }).getState().expressionHelpers[name] = helper;
}
