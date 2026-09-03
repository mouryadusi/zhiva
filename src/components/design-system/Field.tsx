import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, useId } from 'react';
import clsx from 'clsx';

/**
 * Every text input/select in the app should use this class list. Two
 * real accessibility gaps this fixes at the source instead of at each
 * of the 13+ call sites that had drifted into copy-pasted, slightly
 * different versions of the same styling:
 *   1. Focus was border-color-only — a weak signal for low-vision
 *      users. This adds a visible ring on top of the border change.
 *   2. Nothing enforced that every input actually has a label — see
 *      the Field component below, which makes an unlabeled input the
 *      unusual case instead of the default.
 */
export function inputClasses(className?: string) {
  return clsx(
    'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none',
    'focus:border-accent focus:ring-2 focus:ring-accent/20',
    className
  );
}

/**
 * Wraps a form control with a real, associated <label>. Pass
 * `labelVisible={false}` for compact UI (search bars, inline quick-add
 * rows) where a visible label would look wrong by design — the label
 * still exists in the DOM and is announced by screen readers via
 * sr-only styling, it just isn't painted on screen. This is the
 * correct pattern (a real associated label, visually hidden) rather
 * than the placeholder-only pattern it replaces.
 */
export function Field({
  label,
  labelVisible = true,
  hint,
  containerClassName,
  children,
}: {
  label: string;
  labelVisible?: boolean;
  hint?: string;
  containerClassName?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={labelVisible ? 'mb-1 block text-sm font-medium text-ink' : 'sr-only'}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function LabeledInput({
  label,
  labelVisible = true,
  hint,
  containerClassName,
  className,
  ...props
}: { label: string; labelVisible?: boolean; hint?: string; containerClassName?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} labelVisible={labelVisible} hint={hint} containerClassName={containerClassName}>
      {(id) => <input id={id} className={inputClasses(className)} {...props} />}
    </Field>
  );
}

export function LabeledTextarea({
  label,
  labelVisible = true,
  hint,
  containerClassName,
  className,
  ...props
}: { label: string; labelVisible?: boolean; hint?: string; containerClassName?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} labelVisible={labelVisible} hint={hint} containerClassName={containerClassName}>
      {(id) => <textarea id={id} className={inputClasses(className)} {...props} />}
    </Field>
  );
}
export function LabeledSelect({
  label,
  labelVisible = true,
  hint,
  containerClassName,
  className,
  children,
  ...props
}: { label: string; labelVisible?: boolean; hint?: string; containerClassName?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} labelVisible={labelVisible} hint={hint} containerClassName={containerClassName}>
      {(id) => (
        <select id={id} className={inputClasses(className)} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}
