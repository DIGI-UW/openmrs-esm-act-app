import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Checkbox,
  CheckboxGroup,
  InlineNotification,
  Modal,
  PasswordInput,
  RadioButton,
  RadioButtonGroup,
  Search,
  Stack,
  TextInput,
} from '@carbon/react';
import { passwordHint } from './password-hint';
import { type Clinic, type ClinicUser, type NamedRole, type PasswordRules } from './users.resource';

/** Above this many clinics, the form finds them by name instead of listing them all. */
const manyClinics = 10;

export interface UserFormValues {
  givenName: string;
  familyName: string;
  gender: string;
  username: string;
  password: string;
  roles: Array<string>;
  clinics: Array<string>;
}

interface UserFormProps {
  /** The user being edited; a new user when absent. */
  user?: ClinicUser;
  roles: Array<NamedRole>;
  roleLabel: (role: NamedRole) => string;
  /** The clinics this administrator may add or remove. */
  clinics: Array<Clinic>;
  clinicName: (uuid: string) => string;
  passwordRules?: PasswordRules;
  onSave: (values: UserFormValues) => Promise<void>;
  onClose: () => void;
}

/** Adds a user, or edits a user's roles and clinics. Saving is checked by ACT Core, which may refuse it. */
export function UserForm({
  user,
  roles,
  roleLabel,
  clinics,
  clinicName,
  passwordRules,
  onSave,
  onClose,
}: UserFormProps) {
  const { t } = useTranslation();
  const editing = Boolean(user);
  const [values, setValues] = useState<UserFormValues>({
    givenName: '',
    familyName: '',
    gender: '',
    username: '',
    password: '',
    roles: user?.roles.map((role) => role.uuid) ?? [],
    clinics: user?.clinics ?? [],
  });
  const [clinicQuery, setClinicQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const set = (change: Partial<UserFormValues>) => setValues((current) => ({ ...current, ...change }));
  const toggle = (list: Array<string>, uuid: string, on: boolean) =>
    on ? [...list, uuid] : list.filter((each) => each !== uuid);

  // A user's roles this administrator may not give, and its clinics it doesn't manage, stay as they are.
  const fixedRoles = (user?.roles ?? []).filter((role) => !roles.some((r) => r.uuid === role.uuid));
  const offeredClinics = clinics.map((clinic) => clinic.uuid);
  const fixedClinics = (user?.clinics ?? []).filter((uuid) => !offeredClinics.includes(uuid));
  // An administrator of every clinic chooses among dozens, so it finds them by name; chosen ones stay listed.
  const findClinics = clinics.length > manyClinics;
  const words = clinicQuery.trim().toLowerCase();
  const listedClinics = findClinics
    ? clinics.filter(
        (clinic) => values.clinics.includes(clinic.uuid) || (words && clinic.display.toLowerCase().includes(words)),
      )
    : clinics;

  const complete =
    values.roles.length > 0 &&
    values.clinics.length > 0 &&
    (editing ||
      (values.givenName.trim() &&
        values.familyName.trim() &&
        values.gender &&
        values.username.trim() &&
        values.password));

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(values);
    } catch (e) {
      setError(refusalMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      modalHeading={editing ? t('editUser', 'Edit {{name}}', { name: user.display }) : t('addUser', 'Add user')}
      primaryButtonText={saving ? t('saving', 'Saving') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={!complete || saving}
      onRequestSubmit={save}
      onRequestClose={onClose}
      size="sm"
    >
      <Stack gap={5}>
        {!editing && (
          <>
            <TextInput
              id="user-given-name"
              labelText={t('givenName', 'Given name')}
              value={values.givenName}
              onChange={(e) => set({ givenName: e.target.value })}
            />
            <TextInput
              id="user-family-name"
              labelText={t('familyName', 'Family name')}
              value={values.familyName}
              onChange={(e) => set({ familyName: e.target.value })}
            />
            <RadioButtonGroup
              legendText={t('sex', 'Sex')}
              name="user-gender"
              valueSelected={values.gender}
              onChange={(gender) => set({ gender: String(gender) })}
            >
              <RadioButton id="user-gender-f" labelText={t('female', 'Female')} value="F" />
              <RadioButton id="user-gender-m" labelText={t('male', 'Male')} value="M" />
            </RadioButtonGroup>
            <TextInput
              id="user-username"
              labelText={t('username', 'Username')}
              value={values.username}
              onChange={(e) => set({ username: e.target.value })}
            />
            <PasswordInput
              id="user-password"
              labelText={t('password', 'Password')}
              helperText={passwordHint(t, passwordRules)}
              value={values.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          </>
        )}
        <CheckboxGroup legendText={t('roles', 'Roles')}>
          {roles.map((role) => (
            <Checkbox
              key={role.uuid}
              id={`user-role-${role.uuid}`}
              labelText={roleLabel(role)}
              checked={values.roles.includes(role.uuid)}
              onChange={(_, { checked }) => set({ roles: toggle(values.roles, role.uuid, checked) })}
            />
          ))}
          {fixedRoles.map((role) => (
            <Checkbox key={role.uuid} id={`user-role-${role.uuid}`} labelText={roleLabel(role)} checked disabled />
          ))}
        </CheckboxGroup>
        {findClinics && (
          <Search
            size="md"
            labelText={t('findClinic', 'Find a clinic')}
            placeholder={t('findClinic', 'Find a clinic')}
            value={clinicQuery}
            onChange={(e) => setClinicQuery(e.target.value)}
          />
        )}
        <CheckboxGroup legendText={t('clinics', 'Clinics')}>
          {listedClinics.map((clinic) => (
            <Checkbox
              key={clinic.uuid}
              id={`user-clinic-${clinic.uuid}`}
              labelText={clinic.display}
              checked={values.clinics.includes(clinic.uuid)}
              onChange={(_, { checked }) => set({ clinics: toggle(values.clinics, clinic.uuid, checked) })}
            />
          ))}
          {fixedClinics.map((uuid) => (
            <Checkbox key={uuid} id={`user-clinic-${uuid}`} labelText={clinicName(uuid)} checked disabled />
          ))}
        </CheckboxGroup>
        {error && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('couldNotSaveUser', 'Could not save the user')}
            subtitle={error}
          />
        )}
      </Stack>
    </Modal>
  );
}

/** The reason in a refusal such as "User is logged in but doesn't have the relevant privilege [reason]". */
export function refusalMessage(e: { message?: string; responseBody?: { error?: { message?: string } } }) {
  const message = e?.responseBody?.error?.message ?? e?.message ?? '';
  return message.match(/\[(.+)\]\s*$/)?.[1] ?? message;
}
