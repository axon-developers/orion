import { clsx, type ClassValue } from 'clsx';
import { PureComponent } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
