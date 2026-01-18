import { INotice } from "../../src/ports/IAppContext";

export class FakeNotice implements INotice {
  messages: string[] = [];

  notify(message: string): void {
    this.messages.push(message);
  }
}
