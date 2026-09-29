import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface SchemaQuestion {
  id?: string;
  questionOptions?: { concept?: string };
  questions?: Array<SchemaQuestion>;
}

interface FormSchema {
  pages?: Array<{ sections?: Array<{ questions?: Array<SchemaQuestion> }> }>;
}

interface FormWithResources {
  resources?: Array<{ name: string; valueReference: string }>;
}

// How long after the launch to wait for the form engine to render the question.
const waitMs = 15_000;

// How long to keep the question in view while the form fills in above it, unless the user takes over first.
const settleMs = 3_000;

/** The ids of the schema's questions that record the concept, in the order the form shows them. */
function questionIds(schema: FormSchema, conceptUuid: string) {
  const ids: Array<string> = [];
  const visit = (questions: Array<SchemaQuestion> = []) =>
    questions.forEach((question) => {
      if (question.id && question.questionOptions?.concept === conceptUuid) {
        ids.push(question.id);
      }
      visit(question.questions);
    });
  schema.pages?.forEach((page) => page.sections?.forEach((section) => visit(section.questions)));
  return ids;
}

// What can take focus inside a question the form engine wraps, such as a dropdown's button or a date's fields.
const focusable = 'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])';

/**
 * The form engine has no way to be told which question to open at, so this finds the question by the id the
 * engine renders it with, or a radio group by its buttons' name, inside a form.
 */
function renderedQuestion(ids: Array<string>) {
  const forms = Array.from(document.forms);
  for (const id of ids) {
    for (const form of forms) {
      const element =
        Array.from(form.querySelectorAll('[id]')).find((candidate) => candidate.id === id) ??
        Array.from(form.querySelectorAll('[name]')).find((candidate) => candidate.getAttribute('name') === id);
      if (element instanceof HTMLElement) {
        return element;
      }
    }
  }
  return null;
}

/**
 * Once the form entry workspace renders the form, scrolls to and focuses the first question that records
 * the concept. Leaves the form at the top when no question records it or none is rendered in time.
 */
export async function focusFormQuestion(form: FormWithResources, conceptUuid: string) {
  const schemaResource = form.resources?.find((resource) => resource.name === 'JSON schema');
  if (!schemaResource) {
    return;
  }
  const { data } = await openmrsFetch<FormSchema>(`${restBaseUrl}/clobdata/${schemaResource.valueReference}`);
  const ids = questionIds(data, conceptUuid);
  if (!ids.length) {
    return;
  }
  const focus = () => {
    const question = renderedQuestion(ids);
    if (question) {
      question.scrollIntoView({ block: 'center' });
      const control = question.matches(focusable) ? question : question.querySelector<HTMLElement>(focusable);
      control?.focus({ preventScroll: true });
      keepInView(question);
    }
    return Boolean(question);
  };
  if (focus()) {
    return;
  }
  const observer = new MutationObserver(() => focus() && stop());
  const timeout = setTimeout(() => stop(), waitMs);
  const stop = () => {
    observer.disconnect();
    clearTimeout(timeout);
  };
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * The form engine renders a question before it has filled in the questions above it, which then push it out
 * of view. Scrolls it back each time it moves, until the form settles, the user scrolls, clicks or types, or the
 * question leaves the page.
 */
function keepInView(question: HTMLElement) {
  const userInput = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  let top = question.getBoundingClientRect().top;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
    userInput.forEach((event) => window.removeEventListener(event, stop, true));
  };
  const timeout = setTimeout(stop, settleMs);
  userInput.forEach((event) => window.addEventListener(event, stop, true));
  const check = () => {
    // The form was closed, or the engine replaced the question.
    if (!question.isConnected) {
      return stop();
    }
    const now = question.getBoundingClientRect().top;
    if (Math.abs(now - top) > 1) {
      question.scrollIntoView({ block: 'center' });
      top = question.getBoundingClientRect().top;
    }
    frame = requestAnimationFrame(check);
  };
  frame = requestAnimationFrame(check);
}
