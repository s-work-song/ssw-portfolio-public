interface RadioArrowInput {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** 포커스 이동은 Radix가 소유하고, 빠른 keyup으로 빠진 선택 클릭만 보완한다. */
export class SettingsRadioKeyboardSelection<T> {
  private sequence = 0;
  private pending: { token: number; origin: T } | null = null;

  begin(input: RadioArrowInput, origin: T): number | null {
    this.cancel();
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(input.key) ||
      input.altKey || input.ctrlKey || input.metaKey || input.shiftKey
    ) return null;
    const token = ++this.sequence;
    this.pending = { token, origin };
    return token;
  }

  consumeFocus(target: T): boolean {
    if (!this.pending || this.pending.origin === target) return false;
    this.cancel();
    return true;
  }

  expire(token: number): void {
    if (this.pending?.token === token) this.cancel();
  }

  cancel(): void {
    this.pending = null;
  }
}
