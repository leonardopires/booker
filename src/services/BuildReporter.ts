import {
  BuildEvent,
  BuildEventLevel,
  BuildReport,
  BuildReportCounts,
  BuildReportStatus
} from "../domain/types";
import { UserMessagePresenter } from "./UserMessagePresenter";

/**
 * Tracks build notice events, aggregates status counts, and emits formatted notices.
 */
export class BuildReporter {
  private readonly events: BuildEvent[] = [];
  private readonly counts: BuildReportCounts = { success: 0, warning: 0, error: 0 };

  constructor(private readonly presenter: UserMessagePresenter) {}

  /**
   * Record an info notice for a file.
   */
  info(fileLabel: string, message: string): void {
    this.record("info", fileLabel, message);
  }

  /**
   * Record a success notice for a file.
   */
  success(fileLabel: string, message: string): void {
    this.record("success", fileLabel, message);
  }

  /**
   * Record a warning notice for a file.
   */
  warning(fileLabel: string, message: string): void {
    this.record("warning", fileLabel, message);
  }

  /**
   * Record an error notice for a file.
   */
  error(fileLabel: string, message: string): void {
    this.record("error", fileLabel, message);
  }

  /**
   * Emit a notice without affecting aggregate counts.
   */
  announce(level: BuildEventLevel, fileLabel: string, message: string): void {
    const event = { level, fileLabel, message };
    this.events.push(event);
    switch (level) {
      case "success":
        this.presenter.showSuccessForFile(fileLabel, message);
        return;
      case "warning":
        this.presenter.showWarningForFile(fileLabel, message);
        return;
      case "error":
        this.presenter.showErrorForFile(fileLabel, message);
        return;
      case "info":
      default:
        this.presenter.showInfoForFile(fileLabel, message);
    }
  }

  /**
   * Return the aggregated build report.
   */
  getReport(): BuildReport {
    return {
      status: this.getStatus(),
      counts: { ...this.counts },
      events: [...this.events]
    };
  }

  private record(level: BuildEventLevel, fileLabel: string, message: string): void {
    const event = { level, fileLabel, message };
    this.events.push(event);
    switch (level) {
      case "success":
        this.counts.success += 1;
        this.presenter.showSuccessForFile(fileLabel, message);
        return;
      case "warning":
        this.counts.warning += 1;
        this.presenter.showWarningForFile(fileLabel, message);
        return;
      case "error":
        this.counts.error += 1;
        this.presenter.showErrorForFile(fileLabel, message);
        return;
      case "info":
      default:
        this.presenter.showInfoForFile(fileLabel, message);
    }
  }

  private getStatus(): BuildReportStatus {
    if (this.counts.error > 0) {
      return "error";
    }
    if (this.counts.warning > 0) {
      return "warning";
    }
    return "success";
  }
}
