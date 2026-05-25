export interface IStoragePort {
  upload(path: string, buffer: Buffer, mimeType: string): Promise<string>; // returns public URL
  delete(path: string): Promise<void>;
}
