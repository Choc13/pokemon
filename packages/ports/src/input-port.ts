export type InputAction =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'menu'
  | 'debug';

export interface InputPort {
  onAction(callback: (action: InputAction) => void): void;
  removeAction(callback: (action: InputAction) => void): void;
  isPressed(action: InputAction): boolean;
}
