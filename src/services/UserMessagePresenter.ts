import { INotice } from "../ports/IAppContext";
import { BuildEventLevel } from "../domain/types";

/**
 * Handles formatting and emitting user-facing Booker notices.
 */
export class UserMessagePresenter {
  private static readonly defaultLabel = "Booker";

  constructor(private readonly notice: INotice) {}

  /**
   * Format a notice message with the required emoji + file label prefix.
   *
   * @param level - Notice severity level to map to an emoji.
   * @param fileLabel - File label to show in brackets.
   * @param message - Notice body message.
   */
  formatNotice(level: BuildEventLevel, fileLabel: string, message: string): string {
    const prefix = this.getEmoji(level);
    return `${prefix} [${fileLabel}] ${message}`;
  }

  /**
   * Show an error notice for a file-related message.
   */
  showErrorForFile(fileLabel: string, message: string): void {
    this.notice.notify(this.formatNotice("error", fileLabel, message));
  }

  /**
   * Show a warning notice for a file-related message.
   */
  showWarningForFile(fileLabel: string, message: string): void {
    this.notice.notify(this.formatNotice("warning", fileLabel, message));
  }

  /**
   * Show a success notice for a file-related message.
   */
  showSuccessForFile(fileLabel: string, message: string): void {
    this.notice.notify(this.formatNotice("success", fileLabel, message));
  }

  /**
   * Show an informational notice for a file-related message.
   */
  showInfoForFile(fileLabel: string, message: string): void {
    this.notice.notify(this.formatNotice("info", fileLabel, message));
  }

  /**
   * Show an error notice that is not tied to a specific file.
   */
  showError(message: string): void {
    this.showErrorForFile(UserMessagePresenter.defaultLabel, message);
  }

  /**
   * Show a warning notice that is not tied to a specific file.
   */
  showWarning(message: string): void {
    this.showWarningForFile(UserMessagePresenter.defaultLabel, message);
  }

  /**
   * Show a success notice that is not tied to a specific file.
   */
  showSuccess(message: string): void {
    this.showSuccessForFile(UserMessagePresenter.defaultLabel, message);
  }

  /**
   * Show an informational notice that is not tied to a specific file.
   */
  showInfo(message: string): void {
    this.showInfoForFile(UserMessagePresenter.defaultLabel, message);
  }

  private getEmoji(level: BuildEventLevel): string {
    switch (level) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "success":
        return "✅";
      case "info":
      default:
        return "ℹ️";
    }
  }
}
