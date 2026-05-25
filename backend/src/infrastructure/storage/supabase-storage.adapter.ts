import type { IStoragePort } from '@/domain/ports/storage.port';
import { DomainError }       from '@/shared/errors/domain-error';

const BUCKET = 'beautybook-media';

export class SupabaseStorageAdapter implements IStoragePort {
  private readonly storageUrl: string;
  private readonly authHeader: string;

  constructor(supabaseUrl: string | undefined, serviceRoleKey: string | undefined) {
    this.storageUrl = supabaseUrl ? `${supabaseUrl}/storage/v1/object` : '';
    this.authHeader = serviceRoleKey ? `Bearer ${serviceRoleKey}` : '';
  }

  async upload(path: string, buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.storageUrl || !this.authHeader) {
      throw new DomainError('Storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)', 'STORAGE_NOT_CONFIGURED');
    }

    const url = `${this.storageUrl}/${BUCKET}/${path}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type':  mimeType,
        'x-upsert':      'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase storage upload failed: ${res.status} ${text}`);
    }

    // Public URL format: {supabaseUrl}/storage/v1/object/public/{bucket}/{path}
    const supabaseUrl = this.storageUrl.replace('/storage/v1/object', '');
    return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  async delete(path: string): Promise<void> {
    if (!this.storageUrl || !this.authHeader) return;

    const url = `${this.storageUrl}/${BUCKET}`;
    const res = await fetch(url, {
      method:  'DELETE',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ prefixes: [path] }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase storage delete failed: ${res.status} ${text}`);
    }
  }
}
