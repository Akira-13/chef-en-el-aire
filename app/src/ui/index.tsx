// Componentes básicos de la interfaz. Todos respetan objetivos táctiles ≥ 44 px (RNF-08) y
// usan los tokens de theme/tokens.css.

import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import styles from './ui.module.css';

function cx(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        size === 'lg' && styles.large,
        block && styles.block,
        className,
      )}
      {...props}
    />
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nombre accesible obligatorio: el contenido suele ser un ícono o emoji. */
  'aria-label': string;
  variant?: 'surface' | 'primary';
  /** Diámetro en px; nunca menor que el objetivo táctil mínimo. */
  size?: number;
}

export function IconButton({
  variant = 'surface',
  size = 48,
  className,
  style,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.iconButton, variant === 'primary' && styles.primary, className)}
      style={{ '--icon-size': `${size}px`, ...style } as CSSProperties}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.card, className)} {...props} />;
}

export type ChipTone = 'neutral' | 'have' | 'missing' | 'substitute' | 'timer';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = 'neutral', className, ...props }: ChipProps) {
  return (
    <span className={cx(styles.chip, tone !== 'neutral' && styles[tone], className)} {...props} />
  );
}

export interface ScreenProps {
  header?: ReactNode;
  footer?: ReactNode;
  /** Fondo crema, de corcho (modo cocina) o primario (celebración). */
  background?: 'cream' | 'cork' | 'primary';
  children: ReactNode;
}

const SCREEN_BACKGROUNDS = {
  cream: styles.bgCream,
  cork: styles.bgCork,
  primary: styles.bgPrimary,
};

export function Screen({ header, footer, background = 'cream', children }: ScreenProps) {
  return (
    <div className={cx(styles.screen, SCREEN_BACKGROUNDS[background])}>
      {header && <header className={styles.screenHeader}>{header}</header>}
      <main className={styles.screenMain}>{children}</main>
      {footer && <footer className={styles.screenFooter}>{footer}</footer>}
    </div>
  );
}
