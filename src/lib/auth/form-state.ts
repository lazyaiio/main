export type FormState = {
  error?: string;
  message?: string;
  success?: boolean;
  /** Echoed back so the form keeps what the user typed (never passwords). */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};
