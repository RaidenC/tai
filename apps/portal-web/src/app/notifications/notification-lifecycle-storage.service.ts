import { Injectable } from '@angular/core';

export interface NotificationLifecycleScope {
  tenantId: string;
  userId: string;
}

export interface NotificationLifecycleRecord {
  readAt: string | null;
  acknowledgedAt: string | null;
}

export type NotificationLifecycleRecords = Record<string, NotificationLifecycleRecord>;

const STORAGE_PREFIX = 'tai.portal.notifications.lifecycle.v1';
const SCOPE_INDEX_KEY = 'tai.portal.notifications.lifecycle.scopes.v1';
const MAX_SCOPE_COUNT = 10;
export const MAX_LIFECYCLE_RECORDS_PER_SCOPE = 1500;

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function encodeNotificationKeySegment(value: string): string {
  return encodeURIComponent(String(value));
}

function isValidIsoDate(value: string): boolean {
  return ISO_UTC_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidTimestampOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isValidIsoDate(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({ providedIn: 'root' })
export class NotificationLifecycleStorageService {
  getScopeKey(scope: NotificationLifecycleScope): string {
    return `${STORAGE_PREFIX}:${encodeNotificationKeySegment(scope.tenantId)}:${encodeNotificationKeySegment(scope.userId)}`;
  }

  read(scope: NotificationLifecycleScope): NotificationLifecycleRecords {
    const key = this.getScopeKey(scope);

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!isPlainRecord(parsed)) {
        return {};
      }

      const result: NotificationLifecycleRecords = {};
      for (const [eventId, value] of Object.entries(parsed)) {
        if (DANGEROUS_KEYS.has(eventId) || !isPlainRecord(value)) {
          continue;
        }

        const readAt = value['readAt'];
        const acknowledgedAt = value['acknowledgedAt'];

        if (!isValidTimestampOrNull(readAt) || !isValidTimestampOrNull(acknowledgedAt)) {
          continue;
        }

        result[eventId] = { readAt, acknowledgedAt };
      }

      this.touchScopeKey(key);
      return result;
    } catch {
      return {};
    }
  }

  write(
    scope: NotificationLifecycleScope,
    records: NotificationLifecycleRecords,
    retainedEventIds: string[]
  ): void {
    const key = this.getScopeKey(scope);
    const retainedWindow = retainedEventIds.slice(-MAX_LIFECYCLE_RECORDS_PER_SCOPE);
    const pruned: NotificationLifecycleRecords = {};

    for (const eventId of retainedWindow) {
      if (DANGEROUS_KEYS.has(eventId)) {
        continue;
      }

      const record = records[eventId];
      if (record) {
        pruned[eventId] = record;
      }
    }

    try {
      localStorage.setItem(key, JSON.stringify(pruned));
      this.touchScopeKey(key);
    } catch {
      return;
    }
  }

  private touchScopeKey(key: string): void {
    const existing = this.readScopeIndex().filter(item => item !== key);
    const next = [key, ...existing].slice(0, MAX_SCOPE_COUNT);
    const removed = existing.slice(MAX_SCOPE_COUNT - 1);

    try {
      localStorage.setItem(SCOPE_INDEX_KEY, JSON.stringify(next));
      for (const removedKey of removed) {
        localStorage.removeItem(removedKey);
      }
      this.cleanupUnindexedScopeKeys(new Set(next));
    } catch {
      return;
    }
  }

  private cleanupUnindexedScopeKeys(activeKeys: Set<string>): void {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(`${STORAGE_PREFIX}:`) && !activeKeys.has(storageKey)) {
        localStorage.removeItem(storageKey);
      }
    }
  }

  private readScopeIndex(): string[] {
    try {
      const raw = localStorage.getItem(SCOPE_INDEX_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}