// Componentes básicos de la interfaz. Todos respetan objetivos táctiles ≥ 44 px (RNF-08) y
// usan los tokens de theme/tokens.css.

import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import styles from './ui.module.css';

export function cx(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'timer';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
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

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Tarjeta "clavada" al tablero, con su chincheta. */
  pinned?: boolean;
}

export function Card({ pinned = false, className, ...props }: CardProps) {
  return <div className={cx(styles.card, pinned && styles.pinned, className)} {...props} />;
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
  /** Título de la pestaña y del historial del navegador (WCAG 2.4.2). */
  title?: string;
  header?: ReactNode;
  footer?: ReactNode;
  /** Fondo crema, de corcho (modo cocina) o primario (celebración). */
  background?: 'cream' | 'cork' | 'primary';
  /** Ocupa justo la pantalla: el pie queda siempre a la vista y solo se desplaza el contenido. */
  fixed?: boolean;
  children: ReactNode;
}

const SCREEN_BACKGROUNDS = {
  cream: styles.bgCream,
  cork: styles.bgCork,
  primary: styles.bgPrimary,
};

const APP_NAME = 'Chef en el Aire';

export function Screen({
  title,
  header,
  footer,
  background = 'cream',
  fixed = false,
  children,
}: ScreenProps) {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);

  // Al entrar a una pantalla, el foco pasa a su contenido para el teclado y el lector (RNF-08).
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={cx(styles.screen, SCREEN_BACKGROUNDS[background], fixed && styles.fixed)}>
      {header && <header className={styles.screenHeader}>{header}</header>}
      <main ref={main} tabIndex={-1} className={styles.screenMain}>
        {children}
      </main>
      {footer && <footer className={styles.screenFooter}>{footer}</footer>}
    </div>
  );
}
