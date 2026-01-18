import { IAppContext } from "../../src/ports/IAppContext";
import { FakeMetadataCache } from "./FakeMetadataCache";
import { FakeNotice } from "./FakeNotice";
import { FakeVault } from "./FakeVault";

export class FakeAppContext implements IAppContext {
  vault: FakeVault;
  metadataCache: FakeMetadataCache;
  notice: FakeNotice;

  constructor(initialFiles: Record<string, string> = {}) {
    this.vault = new FakeVault(initialFiles);
    this.metadataCache = new FakeMetadataCache(this.vault);
    this.notice = new FakeNotice();
  }
}
