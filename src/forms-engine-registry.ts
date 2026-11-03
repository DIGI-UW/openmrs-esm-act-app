import { getGlobalStore } from '@openmrs/esm-framework';

// The form engine's `FormsStore`; whoever asks first creates it, so it starts with every list empty.
const formsEngineStore = 'forms-engine-store';

interface ControlRegistration {
  name: string;
  type: string;
  load: () => Promise<{ default: unknown }>;
}

interface FormsEngineRegistry {
  controls: Array<ControlRegistration>;
  postSubmissionActions: Array<unknown>;
  expressionHelpers: Record<string, Function>;
  fieldValidators: Array<unknown>;
  fieldValueAdapters: Array<unknown>;
  dataSources: Array<unknown>;
  formSchemaTransformers: Array<unknown>;
}

const registry = () =>
  getGlobalStore<FormsEngineRegistry>(formsEngineStore, {
    controls: [],
    postSubmissionActions: [],
    expressionHelpers: {},
    fieldValidators: [],
    fieldValueAdapters: [],
    dataSources: [],
    formSchemaTransformers: [],
  }).getState();

/** Lets a form's calculate expression call the helper by its name. */
export function registerExpressionHelper(name: string, helper: Function) {
  registry().expressionHelpers[name] = helper;
}

/** Lets a form's question name the control as its rendering. */
export function registerControl(name: string, load: ControlRegistration['load']) {
  const { controls } = registry();
  if (!controls.some((control) => control.name === name)) {
    controls.push({ name, type: name, load });
  }
}
