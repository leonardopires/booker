import { INotice } from "../ports/IAppContext";

export class UserMessagePresenter {
  constructor(private readonly notice: INotice) {}

  showError(message: string): void {
    this.notice.notify(`❌ ${message}`);
  }

  showWarning(message: string): void {
    this.notice.notify(`⚠️ ${message}`);
  }

  showSuccess(message: string): void {
    this.notice.notify(`✅ ${message}`);
  }

  showInfo(message: string): void {
    this.notice.notify(`ℹ️ ${message}`);
  }
}
