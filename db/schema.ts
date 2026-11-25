import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const preferences = sqliteTable('preferences', {
  owner: text('owner').primaryKey(), payload: text('payload').notNull(), updated: text('updated').notNull(),
});
export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), payload: text('payload').notNull(),
  created: text('created').notNull(), updated: text('updated').notNull(),
});
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), key: text('key').notNull(),
  filename: text('filename').notNull(), mime: text('mime').notNull(), size: integer('size').notNull(),
  duration: integer('duration').notNull(), width: integer('width').notNull(), height: integer('height').notNull(),
  hash: text('hash').notNull(), created: text('created').notNull(),
});
export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), platform: text('platform').notNull(),
  accountId: text('account_id').notNull(), label: text('label').notNull(), secret: text('secret').notNull(),
  expires: text('expires'), created: text('created').notNull(),
}, t => [uniqueIndex('connection_owner_platform').on(t.owner,t.platform)]);
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), draftId: text('draft_id').notNull(),
  platform: text('platform').notNull(), status: text('status').notNull(), scheduled: text('scheduled').notNull(),
  payload: text('payload').notNull(), remoteId: text('remote_id'), message: text('message').notNull().default(''),
  claimed: text('claimed'), created: text('created').notNull(), updated: text('updated').notNull(),
}, t => [uniqueIndex('one_delivery_per_draft_platform').on(t.owner,t.draftId,t.platform)]);
export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), message: text('message').notNull(),
  kind: text('kind').notNull(), created: text('created').notNull(),
});
export const oauthStates = sqliteTable('oauth_states', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), provider: text('provider').notNull(),
  created: text('created').notNull(), verifier: text('verifier').notNull(),
});

export const runnerLocks = sqliteTable('runner_locks', {
 owner: text('owner').primaryKey(), token: text('token').notNull(), expires: integer('expires').notNull(),
});

export const churchSettings = sqliteTable('church_settings', {
 owner: text('owner').primaryKey(), payload: text('payload').notNull(), updated: text('updated').notNull(),
});
export const churchPosts = sqliteTable('church_posts', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),series:text('series').notNull(),eventId:text('event_id').notNull().default(''),
 localDate:text('local_date').notNull(),scheduled:text('scheduled').notNull(),payload:text('payload').notNull(),
 status:text('status').notNull(),imageKey:text('image_key'),remoteId:text('remote_id'),pageId:text('page_id'),message:text('message').notNull().default(''),
 claimed:text('claimed'),created:text('created').notNull(),updated:text('updated').notNull(),
},t=>[uniqueIndex('church_post_once').on(t.owner,t.series,t.eventId,t.localDate).where(sql`${t.status} <> 'removed'`)]);
export const churchTemplates = sqliteTable('church_templates', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),
 pngKey:text('png_key').notNull(),pixelsKey:text('pixels_key').notNull(),size:integer('size').notNull(),created:text('created').notNull(),archived:integer('archived').notNull().default(0),
});

export const providerApps = sqliteTable('provider_apps', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),provider:text('provider').notNull(),secret:text('secret').notNull(),updated:text('updated').notNull(),
},t=>[uniqueIndex('provider_app_owner').on(t.owner,t.provider)]);

export const canvaAccounts = sqliteTable('canva_accounts', {
 owner:text('owner').primaryKey(),accountId:text('account_id').notNull(),secret:text('secret').notNull(),
 expires:text('expires').notNull(),refreshClaim:text('refresh_claim'),updated:text('updated').notNull(),
});
export const canvaSettings = sqliteTable('canva_settings', {
 owner:text('owner').primaryKey(),payload:text('payload').notNull(),updated:text('updated').notNull(),
});
export const canvaPageRotations = sqliteTable('canva_page_rotations', {
 owner:text('owner').notNull(),series:text('series').notNull(),eventId:text('event_id').notNull().default(''),
 sourceUrl:text('source_url').notNull(),designId:text('design_id').notNull(),pageCount:integer('page_count').notNull(),
 nextPage:integer('next_page').notNull().default(1),updated:text('updated').notNull(),
},t=>[uniqueIndex('canva_page_rotation_key').on(t.owner,t.series,t.eventId,t.sourceUrl)]);
